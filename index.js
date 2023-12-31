import express, { query } from 'express'
import cors from 'cors'
import 'dotenv/config'
import jwt  from  'jsonwebtoken'
//stripe
import Stripe from 'stripe';
const sk = process.env.STRIPE_SECRET_KEY;
const stripeInstance = Stripe(sk);

const app = express();
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());


import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kzarlhv.mongodb.net/?retryWrites=true&w=majority`;

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
      const menuCollection = client.db('bistrobossDB').collection('menu');
      const reviewCollection = client.db('bistrobossDB').collection('reviews');
      const cartCollection = client.db('bistrobossDB').collection('carts');
      const userCollection = client.db('bistrobossDB').collection('users');
      const paymentCollection = client.db('bistrobossDB').collection('payments');

    //middleware
    app.post('/jwt', async(req,res)=>{
      const user = req.body;
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{ expiresIn:'1h' });
      res.send({token});
    })


      const verifyToken = (req,res,next) =>{
        console.log('Inside Verify Token',req.headers.authorization);
        if(!req.headers.authorization){
          return res.status(401).send({ message:'UnAuthorized Access' });
        }
        const token = req.headers.authorization.split(' ')[1];
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, ( err, decoded)=>{
          if(err){
            return res.status(401).send({ message:'UnAuthorized Access' });
          }
          req.decoded = decoded;
          next();
        })
        
      }

      const verifyAdmin = async(req,res,next) =>{
          const email = req.decoded.email;
          const query = { email :email };
          const user = await userCollection.findOne(query);
          const isAdmin = user?.role === 'admin';
          if(!isAdmin){
            return res.status(403).send({message : 'foebidden access'})
          }
          next();
      }

      app.get('/menu',async(req,res)=>{
        const query = menuCollection.find();
        const result = await query.toArray();
        res.send(result);
      })

      app.post('/menu',verifyToken, verifyAdmin, async(req,res)=>{
        const item = req.body;
        const result = await menuCollection.insertOne(item);
        res.send(result);
      })

      app.delete('/menu/:id',verifyToken, verifyAdmin, async(req,res)=>{
        const id = req.params.id;
        const query = { _id : new ObjectId(id) };
        const result = await menuCollection.deleteOne(query);
        res.send(result);
      })

      app.get('/menu/:id',async(req,res)=>{
        const id = req.params.id;
        const query = { _id : new ObjectId(id) }
        const result = await menuCollection.findOne(query);
        res.send(result);
      })

      app.patch('/menu/:id',async(req,res)=>{
        const id = req.params.id;
        const query = { _id : new ObjectId(id) };
        const item = req.body;
        const updatedDoc = {
          $set:{
            name:item.name,
            category:item.category,
            price:item.price,
            recipe:item.recipe,
            image:item.image,
          }
        }
        const result = await menuCollection.updateOne(query,updatedDoc);
        res.send(result);
      })

      app.get('/reviews',async(req,res)=>{
        const query = reviewCollection.find();
        const result = await query.toArray();
        res.send(result);
      })


      app.post('/carts',async(req,res)=>{

        const cart = req.body;
        const result = await cartCollection.insertOne(cart);
        res.send(result);
      })

      app.get('/carts',async(req,res)=>{
        const email = req.query.email;
        console.log(email);
        const query = { email : email }
        const cart = cartCollection.find(query);
        const result = await cart.toArray();
        res.send(result);
      })

      app.delete('/carts/:id',async(req,res)=>{
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await cartCollection.deleteOne(query);
        res.send(result);
      })

      //payments

      app.post('/create-payment-intent',async (req,res)=>{
        const {price} = req.body;
        console.log(price)
        const amount = parseInt(price * 100);
        console.log('amount inside the intent',amount)
        const paymentIntent = await stripeInstance.paymentIntents.create({
            amount:amount,
            currency:'usd',
            payment_method_types:['card']
        });

        res.send({
          clientSecret:paymentIntent.client_secret
        })
      })

      app.post('/payments',async(req,res)=>{
        const payment = req.body;
        const paymentResult = await paymentCollection.insertOne(payment);
        // delete item from the cart
        console.log("payment info",payment)
        const query = { _id : {
          $in : payment.cartIds.map( id => new ObjectId(id) )
        } };
        const deleteResult = await cartCollection.deleteMany(query);
        console.log('deleted result',deleteResult);
        res.send( {paymentResult, deleteResult})
      })

      app.get('/payments/:email',verifyToken, async(req,res)=>{
        const query = {email:req.params.email};
        if(req.params.email !== req.decoded.email){
          return res.status(403).send('Forbidden Access');
        }
        const result = await paymentCollection.find(query).toArray();
        res.send(result);
      })

      app.post('/users',async (req,res)=>{
        const user = req.body;
        const query = { email: user.email };
        const existingUser = await userCollection.findOne(query);
        if(existingUser){
          return res.send({message:'user Already Exist', insertedId : null })
        }

        const result = await userCollection.insertOne(user);
        res.send(result);
      })

      app.get('/users',verifyToken,verifyAdmin, async(req,res)=>{
        const result = await userCollection.find().toArray();
        res.send(result);
      })

      app.delete('/users/:id',verifyToken,verifyAdmin,async(req,res)=>{
        const id = req.params.id;
        const query = { _id :new ObjectId(id)};
        const result = await userCollection.deleteOne(query);
        res.send(result);
      })

      app.patch('/users/admin/:id',verifyToken,verifyAdmin, async(req,res)=>{
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set:{
              role:"admin"
          }
        }
        const result = await userCollection.updateOne(filter,updatedDoc);
        res.send(result);
      })

      app.get('/users/admin/:email',verifyToken, async(req,res)=>{
          const email = req.params.email;
          if(email !== req.decoded.email){
            return res.status(403).send({mssage:'forbidden access'});
          }
          const query = { email: email };
          const user = await userCollection.findOne(query);
          let admin = false;
          if(user){
            admin = user?.role ==='admin';
          }
          res.send({admin});
      })

      //MIDDLEWARE

  
      //admin-stats

      app.get('/admin-stats',async(req,res)=>{

        const totalUser = await userCollection.estimatedDocumentCount();
        const totalMenu = await menuCollection.estimatedDocumentCount();
        const totalOrder = await paymentCollection.estimatedDocumentCount();

        const result = await paymentCollection.aggregate([
          {
            $group:{
              _id:null,
              totalRevenue:{
                $sum:'$price'
              }
            }
          }
        ]).toArray();

        const totalRevenue = result.length > 0 ? result[0].totalRevenue : 0 ;
        const revenue = parseFloat(totalRevenue.toFixed(2));

        res.send({
          totalUser,totalMenu,totalOrder,revenue
        });
      })


      //order-state aggregate 
      // app.get('/order-stats',async(req,res)=>{
      //     const result = await paymentCollection.aggregate([
      //       {
      //         $addFields: {
      //           menuItemIdsAsObjectId: {
      //             $map: {
      //               input: '$menuItemIds',
      //               as: 'menuItemId',
      //               in: { $toObjectId: '$$menuItemId' }
      //             }
      //           }
      //         }
      //       },
      //      {
      //         $unwind :'$menuItemIdsAsObjectId'
      //      },
        
      //      {
      //         $lookup:{
      //             from:'menu',
      //             localField:'menuItemIdsAsObjectId',
      //             foreignField:'_id',
      //             as:'items'
      //         }
      //      },
      //      {
      //         $unwind :'$menuItems'
      //      },
      //      {
      //         $group:{
      //           _id:'$menuItems.category',
      //           quantity:{$sum:1},
      //           revenue:{ $sum:'$menuItems.price'}

      //         }
      //      }
      //     ]).toArray();
      //     res.send(result);
    
      // })

     
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/',(req,res)=>{
    res.send('connected')
})

app.listen(port,()=>{
    console.log(`i am from :${port}`)
})
