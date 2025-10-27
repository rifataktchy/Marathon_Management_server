const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 5000;

const allowedOrigins = [
  'https://merathon-management-system.netlify.app',
  'http://localhost:5173'
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true, // If cookies or other credentials are needed
    // methods: ["GET", "POST", "PUT", "DELETE"],
  })
);
app.use(express.json());
app.use(cookieParser());

// const logger = (req, res, next) => {
//   console.log('inside the logger');
//   next();
// }

const verifyToken = (req, res, next) => {
  //console.log(req.cookies)
  const token = req?.cookies?.token;
  if (!token) {
      return res.status(401).send({ message: 'unAuthorized access' })
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
      }
      req.user = decoded;
      next();
  })

}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.o0bvl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const eventCollection = client.db('merathonDB').collection('event');
    const registerCollection = client.db('merathonDB').collection('register');

    const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

//auth related apis
app.post('/jwt', async (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' });

  res
      .cookie('token', token, {
        httpOnly: true,              // Prevent JavaScript access to the cookie
        secure: true,                // Cookies should be sent only over HTTPS
        sameSite: 'none'
      })
      .send({ success: true })

});

app.post('/logout', (req, res) => {
  res
      .clearCookie('token', {
        httpOnly: true,              // Prevent JavaScript access to the cookie
    secure: true,                // Cookies should be sent only over HTTPS
    sameSite: 'none'
      })
      .send({ success: true })
})


//event related apis
app.post("/events", async (req, res) => {
    try {
      const newEvent = req.body;

      // Ensure required fields are present
      if (
        !newEvent.title ||
        !newEvent.startRegistrationDate ||
        !newEvent.endRegistrationDate ||
        !newEvent.marathonStartDate ||
        !newEvent.location ||
        !newEvent.distance ||
        !newEvent.description ||
        !newEvent.image
      ) {
        return res
          .status(400)
          .json({ error: "All required fields must be provided." });
      }

      // Insert the new event into the database
      const result = await eventCollection.insertOne(newEvent);

      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating marathon event:", error);
      res.status(500).json({ error: "Failed to create event." });
    }
  });

// Fetch All Events
app.get("/events", async (req, res) => {
  const email = req.query.email; // Get email from query params
  const sortOrder = req.query.sortOrder || "desc"; // Default to descending if no sortOrder is provided

  const sortDirection = sortOrder === "asc" ? 1 : -1; // Determine sort direction

  try {
    let cursor;

    // If email is provided, filter by userEmail, else return all events
    if (email) {
      cursor = eventCollection.find({ userEmail: email }).sort({ createdAt: sortDirection });
    } else {
      cursor = eventCollection.find().sort({ createdAt: sortDirection });
    }

    const result = await cursor.toArray();

    // Check if any events were found
    if (result.length === 0) {
      return res.status(404).json({ message: "No events found" });
    }

    res.json(result); // Send all events
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Fetch Only 6 Events
app.get("/events/limited", async (req, res) => {
  const sortOrder = req.query.sortOrder || "desc"; // Default to descending if no sortOrder is provided
  const sortDirection = sortOrder === "asc" ? 1 : -1; // Determine sort direction

  try {
    const cursor = eventCollection.find().sort({ createdAt: sortDirection }).limit(6); // Limit to 6 events
    const result = await cursor.toArray();

    // Check if any events were found
    if (result.length === 0) {
      return res.status(404).json({ message: "No events found" });
    }

    res.json(result); // Send the 6 events
  } catch (error) {
    console.error("Error fetching limited events:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


  
  app.put("/events/:id", async (req, res) => {
    const { id } = req.params;
    const updatedData = req.body;
    try {
      const result = await eventCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );
      res.send(result);
    } catch (error) {
      res.status(500).send({ success: false, message: "Failed to update event." });
    }
  });

// Delete marathon
app.delete("/events/:id",  async (req, res) => {
  const { id } = req.params;
  try {
    const result = await eventCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ success: false, message: "Failed to delete registration." });
  }
});
 
  

   // Route to get a specific campaign by ID
   app.get('/merathon/:id', async (req, res) => {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: "Invalid campaign ID" });
    }
    const query = { _id: new ObjectId(id) };
    try {
      const result = await eventCollection.findOne(query);
      if (!result) {
        return res.status(404).send({ error: "Campaign not found" });
      }
      res.send(result);
    } catch (error) {
      console.error("Error in /merathon/:id", error);
      res.status(500).send({ error: "Internal server error" });
    }
  });

app.post("/register", async (req, res) => {
  const registration = req.body;

  try {
    // Insert the registration data
    const registrationResult = await registerCollection.insertOne(registration);

    // Increment the registration count for the corresponding event
    const incrementResult = await eventCollection.updateOne(
      { _id: new ObjectId(registration.marathonId) },
      { $inc: { registrationCount: 1 } }
    );

    if (incrementResult.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Marathon not found. Registration created, but count not updated.",
      });
    }

    res.send({
      success: true,
      message: "Registration successful and count updated.",
      registrationResult,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).send({
      success: false,
      message: "Internal server error during registration.",
    });
  }
});

app.get("/register", async (req, res) => {
  const { email } = req.query;
  console.log(req.cookies)

  if (!email) {
    return res.status(400).send({ success: false, message: "Email is required." });
  }
  try {
    //    const query = { email };

    // // If there's a search query (for title), add it to the query using case-insensitive regex
    // if (search) {
    //   query.title = { $regex: search, $options: "i" }; // Case-insensitive search for marathon title
    // }
  //   if (req.user.email !== req.query.email) {
  //     return res.status(403).send({ message: 'forbidden access' });
  // }
    // console.log('cuk cuk', req.cookies);
    const registrations = await registerCollection.find({ email }).toArray();
    res.send(registrations);
  } catch (error) {
    res.status(500).send({ success: false, message: "Failed to fetch registrations." });
  }
});

app.put("/register/:id", async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;
  try {
    const result = await registerCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ success: false, message: "Failed to update registration." });
  }
});

app.delete("/register/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await registerCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ success: false, message: "Failed to delete registration." });
  }
});


// app.post('/logout', (req, res) => {
//   res.cookie('token', '', {
//     httpOnly: true,
//     secure: true,
//     expires: new Date(0),
//   });
//   res.send({ success: true, message: 'Logged out successfully' });
// });




// AI chat endpoint
app.post('/chat', async (req, res) => {
  const { message, userEmail } = req.body;

  try {
    // Optionally fetch upcoming events for context
    const upcomingEvents = await eventCollection.find().limit(5).toArray();

    const response = await aiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant for a marathon management website. Use the event data if needed.' },
        { role: 'user', content: message },
        { role: 'system', content: `Here are some upcoming marathons: ${JSON.stringify(upcomingEvents)}` }
      ],
      temperature: 0.7
    });

    const reply = response.choices[0].message.content;
    res.json({ reply });

  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

app.get('/chat', (req, res) => {
  res.send('Chat endpoint is live. Use POST to send messages.');
});

  
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('merathon management system')
})

app.listen(port, () => {
    console.log(`system is waiting at the: ${port}`)
})