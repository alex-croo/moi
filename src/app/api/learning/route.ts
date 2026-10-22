import { learningRequest } from "@/lib/learning-api";
export async function POST(request:Request) { return learningRequest(request); }
