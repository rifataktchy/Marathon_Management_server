const express = require('express');
const cors = require('cors');
// const jwt = require('jsonwebtoken');
// const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
// app.use(cookieParser());



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
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const eventCollection = client.db('merathonDB').collection('event');
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
  //   try {
  //     const events = await eventCollection.find({}).toArray(); // Fetch all events
  //     res.status(200).json(events);
  //   } catch (error) {
  //     console.error("Error fetching events:", error);
  //     res.status(500).json({ error: "Failed to fetch events." });
  //   }
  // });
  app.get('/events', async (req, res) => {
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

// app.post("/registrations", async (req, res) => {
//   const registration = req.body;
//   const result = await registrationCollection.insertOne(registration);
//   res.send(result);
// });

  
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