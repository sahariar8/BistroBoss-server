import express from 'express'
import cors from 'cors'
import 'dotenv/config'

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());


import { MongoClient, ServerApiVersion } from 'mongodb';
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

      app.get('/menu',async(req,res)=>{
        const query = menuCollection.find();
        const result = await query.toArray();
        res.send(result);
      })

      app.get('/reviews',async(req,res)=>{
        const query = reviewCollection.find();
        const result = await query.toArray();
        res.send(result);
      })
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
