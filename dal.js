
import { v4 as uuidv4}  from  "uuid";
import { MONGODB_URI } from "./config.js";
import  {MongoClient } from "mongodb"
const URI = MONGODB_URI;

let db = null


// // connect to mongo
// export const run = async () => {
//   try {
  
//         await MongoClient.connect(URI, { useUnifiedTopology: true}, function(err, client) {
//           console.log("Connected successfully to db server  📦 ✔ in : ");
//           // connect to myproject database
//           db = client.db('DAVID-popeye');
//         })
//     } catch (error) {
//         console.log("error de conexion", error)
//     }
// }
// run()

MongoClient.connect(
  URI ,
  { useUnifiedTopology: true },
  function (err, client) {
    console.log('Connected successfully to db server 📦 ✔ in');

    // connect to myproject database
    db = client.db('ramram');
  }
);


// create user account
export function createCustomer(name, email, password) {
  return new Promise((resolve, reject) => {
    const accountno = uuidv4();
    const collection = db.collection('usuarios');
    const doc = { name, email, password, balance: 0, accountno: accountno, transactions: [] };
    collection.insertOne(doc, { w: 1 }, function (err, result) {
      err ? reject(err) : resolve(doc);
    });
  });
}

export function getCustomer(email) {
  return new Promise((resolve, reject) => {
    const customers = db
      .collection('usuarios')
      .findOne({ email: email })
      .then((doc) => resolve(doc))
      .catch((err) => reject(err));
  });
}

export function updateCustomer(email, amount, transaction) {
  return new Promise((resolve, reject) => {
    const customers = db
      .collection('usuarios')
      .findOneAndUpdate(
        { email: email },
        { $push: { transactions : transaction}, $set: { balance: amount } },
        { returnOriginal: false },
        function (err, documents) {
          err ? reject(err) : resolve(documents);
        }
      );
  });
}

