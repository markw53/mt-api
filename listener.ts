import dotenv from "dotenv";
import app from "./app";

dotenv.config();

const PORT = process.env.PORT || 9090;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}...`);
});