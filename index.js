const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb');



// Load environment variables from .env file
dotenv.config();

const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY); // Initialize Stripe with your secret key


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

        const db = client.db("parcelDB");
        const parcelsCollection = db.collection("parcels");
        const paymentsCollection = db.collection("payments");
        const trackingsCollection = db.collection("trackings");
        const usersCollection = db.collection("users");


        // users related api
        app.post('/users', async (req, res) => {
           const email = req.body.email;
           const userExists= await usersCollection.findOne({email:email});
              if (userExists) {
                return res.status(200).send({ message: 'User already exists' ,inserted: false});
              }
              const user= req.body;
              const result = await usersCollection.insertOne(user);
              res.send(result);

        });

        //  parcel related api
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
        // get a single parcel by id
        // This endpoint retrieves a single parcel by its ID
        app.get('/parcels/:id', async (req, res) => {
            try {
                const id = req.params.id;

                const parcel = await parcelsCollection.findOne({ _id: new ObjectId(id) });

                if (parcel) {
                    res.send({ success: true, data: parcel });
                } else {
                    res.status(404).send({ success: false, error: 'Parcel not found' });
                }
            } catch (error) {
                console.error('❌ Error fetching parcel by ID:', error);
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


        // payment related api
        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            try {
                const { amount } = req.body;
                const paymentIntent = await stripe.paymentIntents.create({
                    amount,
                    currency: 'usd',
                });
                res.json({ clientSecret: paymentIntent.client_secret });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });



        // POST /payments - Save payment info
        app.post('/payments', async (req, res) => {
            const payment = req.body;

            if (!payment.parcelId || !payment.userEmail || !payment.transactionId) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            payment.createdAt = new Date(); // for sorting
            const insertResult = await paymentsCollection.insertOne(payment);

            // Mark parcel as paid
            await parcelsCollection.updateOne(
                { _id: new ObjectId(payment.parcelId) },
                { $set: { payment_status: 'paid' } }
            );

            res.send({ success: true, insertedId: insertResult.insertedId });
        });

        // GET /payments?email=user@example.com - Get payments by user
        app.get('/payments', async (req, res) => {
            const email = req.query.email;

            const query = email ? { userEmail: email } : {};
            const result = await paymentsCollection
                .find(query)
                .sort({ createdAt: -1 }) // Newest first
                .toArray();

            res.send(result);
        });
        // tracking related apis
        // GET /trackings/:trackingId
        app.get('/trackings/:trackingId', async (req, res) => {
            const { trackingId } = req.params;

            const updates = await trackingsCollection
                .find({ trackingId })
                .sort({ timestamp: 1 }) // chronological order
                .toArray();

            if (!updates.length) {
                return res.status(404).send({ success: false, error: 'No tracking updates found' });
            }

            res.send({ success: true, data: updates });
        });

        // POST /trackings
        // POST /trackings
        app.post('/trackings', async (req, res) => {
            const { trackingId, parcelId, userEmail, status, location } = req.body;

            if (!trackingId || !parcelId || !userEmail || !status || !location) {
                return res.status(400).send({ error: 'Missing required fields' });
            }

            const trackingEntry = {
                trackingId,
                parcelId: new ObjectId(parcelId),
                userEmail,
                status,
                location,
                timestamp: new Date()
            };

            const result = await trackingsCollection.insertOne(trackingEntry);
            res.send({ success: true, insertedId: result.insertedId });
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