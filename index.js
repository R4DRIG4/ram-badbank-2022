import { PORT } from "./config.js";
import express from "express";
import cors from "cors";
import { createCustomer, getCustomer, updateCustomer } from "./dal.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import jwt from 'jsonwebtoken';
const { sign, verify } = jwt;

const client = new OAuth2Client(
  "799067649160-km8rmtguji012s39ljbo81alvs8uq9k6.apps.googleusercontent.com",
);

var app = express();
app.use(cors());


app.use(express.json());
// const __dirname = dirname(fileURLToPath(import.meta.url));
// app.use(express.static(join(__dirname, "./client/build")));


var saltRouds = 10;


const getTokenIdMiddleware = async (req, res, next) => {
  if (req.headers.authorization != null) {
    const usertoken = req.headers.authorization;
    console.log(usertoken);
    const token = usertoken.split(" ");
    console.log(token);
    console.log(token[1]);
    const decoded = verify(token[1], "abcdefghijklmnopqrstuvwxyz");

    if (decoded.email != null) {
      req.email = decoded.email;
      next();
    } else {
      res.json("user not found");
    }
  } else {
    res.json("No header ");
  }
};

app.get("/transactions", getTokenIdMiddleware, async (req, res) => {
  console.log("Recibo", req.email);
  getCustomer(req.email).then(async (user) => {
    if (user) {
      res.send({ balance: user.balance, transactions: user.transactions });
    } else {
      console.log("User not found");
      res.status(404).json({ message: "User not found" });
    }
  });
});

app.get("/account/me", getTokenIdMiddleware, async (req, res) => {
  console.log("Entro getLog", req.email);
  const user = await getCustomer(req.email);
  if (user) {
    res.send({ name: user.name, email: user.email, balance: user.balance });
  } else {
    res.status(404).json({ message: "Not logged" });
  }
});

const validateEmail = (email) => {
  return email.match(
    /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  );
};

app.get("/account/create/:name/:email/:password", async (req, res) => {
  if (!validateEmail(req.params.email)) {
    res.status(422).json({ message: "Wrong email format" });
    return;
  }
  getCustomer(req.params.email)
    .then(async (user) => {
      if (user) {
        res.status(409).json({ message: "User already exists" });
      } else {
        const hashedpassword = await bcrypt.hash(
          req.params.password,
          saltRouds
        );
        createCustomer(req.params.name, req.params.email, hashedpassword).then(
          (user) => {
            res.send();
          }
        );
      }
    })
    .catch((err) => {
      console.log("ERROR", err);
      res.status(500).json({ message: "Internal error" });
    });
});

// google login
app.get("/account/googlelogin/:idToken", async function (req, res) {
  const { idToken } = req.params;
  try {
    const { payload: { email_verified, email, name } = {} } =
      await client.verifyIdToken({
        idToken,
        audience:
        "799067649160-km8rmtguji012s39ljbo81alvs8uq9k6.apps.googleusercontent.com",
      });
    let user;
    if (email_verified) {
      user = await getCustomer(email);
      console.log({ user });
      let token = sign({ email: user.email }, "abcdefghijklmnopqrstuvwxyz");
      if (user) {
        return res.status(200).json({
          token,
          user,
        });
      }
      console.log("2");

      let hash = await bcrypt.hash("password-google", saltRouds);
      user = await createCustomer(name, email, hash);
      console.log("1");

      return res.status(200).json({ token });
    }

    return res.status(500).json({ message: "Email not verified" });
  } catch (err) {
    console.log({ err });
    res.status(500).json({ message: "Error while login with google" });
  }
});

app.get("/account/login/:email/:password", function (req, res) {
  getCustomer(req.params.email)
    .then(async (user) => {
      if (user) {
        if (bcrypt.compareSync(req.params.password, user.password)) {
          let token = sign({ email: user.email }, "abcdefghijklmnopqrstuvwxyz");
          res.status(200).json({ token });
        } else {
          res.status(404).json({ message: "Passoword or user incorrect" });
        }
      } else {
        res.status(404).json({ message: "Passoword or user incorrect" });
      }
    })
    .catch((err) => res.status(500).json({ message: "Internal error" }));
});

app.get("/withdraw/:amount", getTokenIdMiddleware, async (req, res) => {
  if (isNaN(req.params.amount)) {
    console.log("NAN");
    res.status(400).json({ message: "Wrong parameter" });
    return;
  }
  const newAmount = parseFloat(req.params.amount);
  if (newAmount <= 0) {
    console.log("Negative or zero");
    res.status(400).json({ message: "Invalid transaction" });
    return;
  }

  getCustomer(req.email).then(async (user) => {
    if (user) {
      if (user.balance < newAmount) {
        res
          .status(400)
          .json({
            message: "Invalid transaction / Monto debe ser inferior al balance",
          });
        return;
      }
      const newBalance = user.balance - newAmount;
      console.log("El balance viejo es:", user.balance);
      console.log("El nuevo balance es:", newBalance);
      console.log("El newAmount es:", newBalance);
      const transaction = {
        date: new Date(),
        type: "Withdraw",
        oldBalance: user.balance,
        newBalance: newBalance,
        amount: req.params.amount,
      };
      await updateCustomer(req.email, newBalance, transaction)
        .then((response) => {
          const updatedUser = response.value;
          res.send({
            name: updatedUser.name,
            email: updatedUser.email,
            balance: updatedUser.balance,
          });
        })
        .catch((err) => res.status(500).json({ message: "Internal error" }));
    } else {
      console.log("User not found");
      res.status(404).json({ message: "User not found" });
    }
  });
});

app.get("/deposit/:amount", getTokenIdMiddleware, async (req, res) => {
  if (isNaN(req.params.amount)) {
    console.log("NAN");
    res.status(400).json({ message: "Wrong parameter" });
    return;
  }
  const newAmount = parseFloat(req.params.amount);
  if (newAmount <= 0) {
    console.log("Negative or zero");
    res.status(400).json({ message: "Invalid transaction" });
    return;
  }
  console.log("Email ", req.email);
  getCustomer(req.email).then(async (user) => {
    if (user) {
      console.log("User found");
      const newBalance = user.balance + newAmount;
      const transaction = {
        date: new Date(),
        type: "Deposit",
        oldBalance: user.balance,
        newBalance: newBalance,
        amount: req.params.amount,
      };
      await updateCustomer(req.email, newBalance, transaction)
        .then((response) => {
          const updatedUser = response.value;
          res.send({
            name: updatedUser.name,
            email: updatedUser.email,
            balance: updatedUser.balance,
          });
        })
        .catch((err) => res.status(500).json({ message: "Internal error" }));
    } else {
      console.log("User not found");
      res.status(404).json({ message: "User not found" });
    }
  });
});



app.listen(PORT);
console.log("Server Running on port: " + PORT + "  🤖 👌");