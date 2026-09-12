import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    app: "BlinkOS",
    version: "2.0.0",
    environment: process.env.NODE_ENV || "production",
    platform: "Vercel Serverless",
    timestamp: new Date().toISOString()
  });
}
