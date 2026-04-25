const mongoose = require("mongoose");
const uri = "mongodb://sahil:BNJ17kaAmKF38tPn@ac-qgheks1-shard-00-00.fqaei0w.mongodb.net:27017,ac-qgheks1-shard-00-01.fqaei0w.mongodb.net:27017,ac-qgheks1-shard-00-02.fqaei0w.mongodb.net:27017/YourCrawl?ssl=true&replicaSet=atlas-ng7t8j-shard-0&authSource=admin";
mongoose.connect(uri).then(() => {
  return mongoose.connection.db.collection("users").updateOne({email: "test@example.com"}, {$set: {verified: true}});
}).then(() => {
  console.log("Updated");
  process.exit(0);
});
