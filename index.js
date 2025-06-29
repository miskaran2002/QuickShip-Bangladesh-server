const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb');



// Load environment variables from .env file
dotenv.config();


const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bbgsyar.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

        const db= client.db("parcelDB");
        const parcelsCollection = db.collection("parcels");

        // parcels api
        // GET parcels (optionally filter by creatorEmail)
        app.get('/parcels', async (req, res) => {
            try {
                const email = req.query.email;
                const filter = email ? { creatorEmail: email } : {};

                const parcels = await parcelsCollection
                    .find(filter)
                    .sort({ creation_date: -1 }) // newest first
                    .toArray();

                res.send({ success: true, data: parcels });
            } catch (error) {
                console.error('❌ Error fetching parcels:', error);
                res.status(500).send({ success: false, error: 'Internal server error' });
            }
        });

        // delete a single parcel
        app.delete('/parcels/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const result = await parcelsCollection.deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount === 1) {
                    res.send({ success: true, message: 'Parcel deleted successfully' });
                } else {
                    res.status(404).send({ success: false, error: 'Parcel not found' });
                }
            } catch (error) {
                console.error('❌ Error deleting parcel:', error);
                res.status(500).send({ success: false, error: 'Internal server error' });
            }
        });
        



        // post a parcel   
        app.post('/parcels', async (req, res) => {
            try {
                const newParcel = req.body;
                const result = await parcelsCollection.insertOne(newParcel);
                res.status(201).send({ success: true, insertedId: result.insertedId });
            } catch (error) {
                console.error('❌ Error inserting parcel:', error);
                res.status(500).send({ success: false, error: 'Failed to insert parcel' });
            }
        });
        







        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);














// Routes
app.get('/', (req, res) => {
    res.send('Zap Shift Server is running'); 
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    
})