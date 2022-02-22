import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import BSON from "bson";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";

dotenv.config();

const corOption = {
  origin: "*"
}
const app = express();
app.use(cors(corOption));
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods:["GET"]
    }
});


let Chat;
mongoose.connect(process.env.CONNECTION_URL)
.then(() => {
  Chat = mongoose.connection.collection("chats");
  console.log("connected to DB seccussfully")
})
.catch(err => {
  console.error(err);
});
const { TokenExpiredError } = jwt;
const catchError = (err) => {
    if(err instanceof TokenExpiredError){
        return new Error( "Unauthorized! Access Token was expired!");
    }

    return new Error( "Unauthorized!");
}

io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if(!token){
      return next(new Error("No token is provided"));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if(err){
          console.log(err);
          return next(catchError(err));
      }
      next();
    });

});

io.on("connection", (socket) => {
  //console.log("socket id",socket.id);

  socket.on("join-chat", (chatId) =>{
    //console.log("chatId",chatId);
    socket.join(chatId);
  });

  socket.on("client-chat", async message => {
    //console.log("message", message);
    let queryDB = {_id:BSON.ObjectId(message.chatId)};
    let today = new Date();
    let day = today.getDate();
    let year = today.getFullYear();
    let month = today.getMonth();
    let hour = today.getHours();
    let minute = today.getMinutes();
    let newMessage = {
        id:uuidv4(),
        text:message.text,
        username:message.username,
        userInfo:message.userInfo,
        sentAt:`${day}/${month}/${year}/${hour}:${minute}`
    };
    let element = { $push: { messages:newMessage } }
    
    try{
      const result = await Chat.updateOne(queryDB, element);

      const { matchedCount, modifiedCount } = result;
      if(matchedCount && modifiedCount) {
        io.to(message.chatId).emit("server-chat", newMessage);
      }
    }catch(err){
      console.log(err);
    }
    
  });
});

httpServer.listen(4000, () =>{
  console.log("server listening on port 4000");
});