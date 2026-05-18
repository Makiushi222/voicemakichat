const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.use(express.static("."));

let waitingUser = null;

io.on("connection", (socket) => {

    console.log("Connected:", socket.id);

    // 🔍 Find Match
    socket.on("findMatch", () => {

        if (waitingUser && waitingUser.id !== socket.id) {

            const roomId =
                "room-" + waitingUser.id + "-" + socket.id;

            socket.join(roomId);
            waitingUser.join(roomId);

            // first user caller
            waitingUser.emit("matched", {
                roomId,
                isCaller: true
            });

            // second user
            socket.emit("matched", {
                roomId,
                isCaller: false
            });

            waitingUser = null;

        } else {

            waitingUser = socket;

            socket.emit("waiting");
        }
    });

    // 📤 Offer
    socket.on("offer", (data) => {

        socket.to(data.roomId)
            .emit("offer", data.offer);
    });

    // 📤 Answer
    socket.on("answer", (data) => {

        socket.to(data.roomId)
            .emit("answer", data.answer);
    });

    // 📤 ICE
    socket.on("ice-candidate", (data) => {

        socket.to(data.roomId)
            .emit("ice-candidate", data.candidate);
    });

    // ⏭️ Next User
    socket.on("next", () => {

        socket.rooms.forEach(room => {

            if (room !== socket.id) {

                socket.leave(room);

                socket.to(room)
                    .emit("partner-disconnected");
            }
        });

        if (waitingUser &&
            waitingUser.id === socket.id) {

            waitingUser = null;
        }

        socket.emit("waiting");
    });

    // ❌ Disconnect
    socket.on("disconnect", () => {

        if (waitingUser &&
            waitingUser.id === socket.id) {

            waitingUser = null;
        }

        socket.rooms.forEach(room => {

            socket.to(room)
                .emit("partner-disconnected");
        });

        console.log("Disconnected:", socket.id);
    });
});

server.listen(process.env.PORT || 3000, () => {

    console.log("Server running");
});
