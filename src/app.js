const express = require("express");
const cors = require("cors");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const routes = require("./routes");
const { swaggerSpec } = require("./docs/swagger");
const {
  errorHandler,
  notFoundHandler,
} = require("./middlewares/error.middleware");
const { rateLimiter } = require("./middlewares/rateLimit.middleware");
const { requestLogger } = require("./middlewares/requestLogger.middleware");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);
app.use(rateLimiter);

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      defaultModelRendering: "example",
      defaultModelsExpandDepth: -1,
      docExpansion: "list",
    },
  }),
);

app.use("/api", routes);
app.get("/", (req, res) => {
  res.send("API is running :rocket:");
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
