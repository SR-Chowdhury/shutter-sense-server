const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const app = express();
require('dotenv').config();
const {
    MongoClient,
    ServerApiVersion,
    ObjectId
} = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);


// Middleware
app.use(express.json());
app.use(cors());
const jwtVerify = (req, res, next) => {
    const authorization = req.headers.authorization;
    
    if(!authorization) {
        return res.status(401).send({error:true, message: 'Unauthorized Access'});
    }

    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({error:true, message: 'Unauthorized Access'});
        }
        req.decoded = decoded;
        next();
    });
} 



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hcsitps.mongodb.net/?retryWrites=true&w=majority`;

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
        // await client.connect();
        client.connect();

        // COLLECTION------------------------------------------------------------
        const userCollection = client.db("shutterSense").collection("users");
        const instructorCollection = client.db("shutterSense").collection("instructors");
        const classCollection = client.db("shutterSense").collection("classes");
        const cartCollection = client.db("shutterSense").collection("carts");
        const paymentCollection = client.db("shutterSense").collection("payments");

        /**
         * JWT-------------------------------------------------------------------
         */
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn : '1h' });
            res.send({token});
        });


        /**
         * User Collection -------------------------------------------------------
         */
        app.get('/users', jwtVerify, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email : user.email };
            const existingUser = await userCollection.findOne(query);
            if(existingUser) {
                return res.send({ message: 'user already exists'});
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        app.get('/checkuser', jwtVerify, async (req, res) => {
            const email = req.query.email;
            const query = { email: email};
            const result = await userCollection.findOne(query);
            res.send(result);
        });


        /**
         * Instructors Collection -------------------------------------------------------
         */
        app.get('/instructors', async (req, res) => {
            const result = await instructorCollection.find().toArray();
            res.send(result);
        });


        /**
         * Class Collection (FRONT-END)------------------------------------------------------------
         */
        app.get('/classes', async (req, res) => {
            const query = { status : "approved"};
            const result = await classCollection.find(query).toArray();
            res.send(result);
        });

        
        /**
         * Cart Collection (FRONT-END)------------------------------------------------------------
         */
        app.get('/carts', jwtVerify, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({error: true, message: 'Forbidden Access'});
            }

            const query = { email : email};
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        });

        app.post('/carts', async (req, res) => {
            const item = req.body;
            // console.log(item);
            const result = await cartCollection.insertOne(item);
            res.send(result);
        });

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id : new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        });


        /**
         * Class Collection (INSTRUCTOR)------------------------------------------------------------
         */
        app.get('/myclasses', jwtVerify, async (req, res) => {
            const email = req.query.email;
            const query = { ins_email : email };
            const result = await classCollection.find(query).toArray();
            res.send(result);
        });
        
        // TODO : Need to add admin Verification
        app.post('/classes', jwtVerify, async (req, res) => {
            const newClass = req.body;
            const result = await classCollection.insertOne(newClass);
            res.send(result);
        });

        // TODO : secure below api
        app.get('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id : new ObjectId(id)};
            const result = await classCollection.findOne(query);
            res.send(result);
        });

        /**
         * Class Collection (ADMIN)------------------------------------------------------------
         */ 
        app.get('/manageclasses', jwtVerify, async (req, res) => {
            const query = { created_by : 'instructor'};
            const result = await classCollection.find(query).toArray();
            res.send(result);
        });  
        
        app.patch('/manageclass/approve/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id : new ObjectId(id)};
            const updateDoc = {
                $set: {
                    status: 'approved'
                }
            };
            const result = await classCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        app.patch('/manageclass/deny/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id : new ObjectId(id)};
            const updateDoc = {
                $set: {
                    status: 'denied'
                }
            };
            const result = await classCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        app.get('/feedback/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id : new ObjectId(id)};
            const result = await classCollection.findOne(query);
            res.send(result);
        });

        app.patch('/feedback/:id', async (req, res) => {
            const id = req.params.id;
            const {feedback} = req.body;
            const query = { _id : new ObjectId(id)};
            const updateDoc = {
                $set: {
                    feedback: feedback
                }
            };
            const result = await classCollection.updateOne(query, updateDoc);
            res.send(result);

        });

        app.get('/manageusers', jwtVerify, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });
        
        app.patch('/manageusers/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id : new ObjectId(id)};
            const updateDoc = {
                $set: {
                    role: 'instructor'
                }
            };
            const result = await userCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        app.patch('/manageusers/admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id : new ObjectId(id)};
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            };
            const result = await userCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        /**
         * Create Payment Intent (Student)------------------------------------------------------------
         */
        app.post('/create-payment-intent', jwtVerify, async (req, res) => {
            const {price} = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount : amount,
                currency : 'usd',
                payment_method_types: ['card']
            });

            res.send({ clientSecret: paymentIntent.client_secret});
        });

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);

            const query = { _id : { $in : payment.cartItems.map(id => new ObjectId(id))}};
            const deleteResult = await cartCollection.deleteMany(query);

            const queryForSeatNumber = { _id : { $in : payment.classItems.map(id => new ObjectId(id))}};
            const updateDoc = {
                    $inc: { available_seats: -1 },
            };
            const updatedResult = await classCollection.updateMany(queryForSeatNumber, updateDoc);

            res.send({insertResult, deleteResult});
        });

        app.get('/paymenthistory', jwtVerify, async (req, res) => {
            const email = req.query.email;
            const query = { email : email };
            const options = {
                sort: { "date": -1 },
            };
            const result = await paymentCollection.find(query, options).toArray();
            res.send(result);
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {}
}
run().catch(console.dir);



// Connection 
app.get('/', (req, res) => res.send('Bismillahir Rahmanir Rahim! ShutterSense Server Side'));
app.listen(port, () => console.log(`Server is running from : ${port} port`));