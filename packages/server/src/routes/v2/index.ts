import { Router } from "express";
import authRouter from "./authRoutes";
import claimRouter from "./claimRoutes";
import walletRouter from "./walletRoutes";
import userRouter from "./userRoutes";

const v2Router = Router();

v2Router.use("/auth", authRouter);
v2Router.use("/wallet", walletRouter);
v2Router.use("/user", userRouter);
v2Router.use("/", claimRouter);

export default v2Router;
