const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();

const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();
let players = {};
let currentPlayer = "w";

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index");
});

io.on("connection", function (uniquesocket) {
  console.log("connected");

  if (!players.white) {
    players.white = uniquesocket.id;
    uniquesocket.emit("playerRole", "w");
  } else if (!players.black) {
    players.black = uniquesocket.id;
    uniquesocket.emit("playerRole", "b");
  } else {
    uniquesocket.emit("spectatorRole");
  }

  uniquesocket.on("disconnect", function () {
    if (uniquesocket.id === players.white) {
      delete players.white;
    } else if (uniquesocket.id === players.black) {
      delete players.black;
    }
  });

  uniquesocket.on("move", (move) => {
    try {
      if (chess.turn() === "w" && uniquesocket.id !== players.white) return;
      if (chess.turn() === "b" && uniquesocket.id !== players.black) return;

      const result = chess.move(move);
      if (result) {
        currentPlayer = chess.turn;
        io.emit("move", move);
        io.emit("boardstate", chess.fen());

        // Check game end conditions
        if (chess.isCheckmate()) {
          const winner = chess.turn() === "w" ? "Black" : "White";
          io.emit("gameEnd", { type: "checkmate", winner });
        } else if (chess.isDraw()) {
          let reason = "draw";
          if (chess.isStalemate()) reason = "stalemate";
          else if (chess.isThreefoldRepetition())
            reason = "threefold repetition";
          else if (chess.isInsufficientMaterial())
            reason = "insufficient material";
          else reason = "fifty-move rule";
          io.emit("gameEnd", { type: "draw", reason });
        }
      } else {
        console.log("Invalid move", move);
        uniquesocket.emit("invalidMove", move);
      }
    } catch (err) {
      console.log(err);
      uniquesocket.emit("invalidMove", move);
    }
  });
});

server.listen(3000, () => {
  console.log("server is running on port 3000");
});
