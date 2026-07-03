import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "npubcash API",
      version: "3.0.0",
      description: "Cashu Lightning Address server API",
    },
    servers: [{ url: "/" }],
  },
  apis: ["./src/routes/**/*.ts", "./src/controller/**/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
