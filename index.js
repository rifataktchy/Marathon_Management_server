const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 5000;

app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const logger = (req, res, next) => {
  console.log('inside the logger');
  next();
}

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

  // app.get("/events", async (req, res) => {
  //   const { email } = req.query;
  //   if (!email) {
  //     return res.status(400).send({ success: false, message: "Email is required." });
  //   }
  //   try {
  //     const registrations = await eventCollection.find({ email }).toArray();
  //     res.send(registrations);
  //   } catch (error) {
  //     res.status(500).send({ success: false, message: "Failed to fetch events." });
  //   }
  // });

  app.get("/events",  async (req, res) => {
    const email = req.query.email; // Get email from query params
    if (!email) {
      const cursor = eventCollection.find();
      const result = await cursor.toArray();
      return res.send(result);
    }

    // Filter campaigns by email if email is provided
    const userCampaigns = await eventCollection.find({ userEmail: email }).toArray();
    res.send(userCampaigns);
  });

  app.put("/events/:id", verifyToken, async (req, res) => {
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
app.delete("/events/:id", verifyToken, async (req, res) => {
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
//   app.get("/events/:id", async (req, res) => {
//   const id = req.params.id;
//   const marathon = await eventCollection.findOne({ _id: new ObjectId(id) });
//   res.send(marathon);
// });

// app.patch("/events/:id", async (req, res) => {
//   const id = req.params.id;
//   const incrementValue = req.body.increment || 1;
//   const result = await eventCollection.updateOne(
//     { _id: new ObjectId(id) },
//     { $inc: { totalRegistrations: incrementValue } }
//   );
//   res.send(result);
// });

// app.post("/register", async (req, res) => {
//   const registration = req.body;
//   const result = await registerCollection.insertOne(registration);
//   res.send(result);
// });

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

app.get("/register", verifyToken, async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).send({ success: false, message: "Email is required." });
  }
  try {
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

app.put("/register/:id", verifyToken, async (req, res) => {
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

app.delete("/register/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await registerCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ success: false, message: "Failed to delete registration." });
  }
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