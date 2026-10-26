import { createHmac, timingSafeEqual } from "node:crypto";

/** Cron queues hold only a two-minute kickoff signature, never the database worker credential. */
export function workerAuthorized(value:string|null,issuedAt:string|null=null,now=Date.now()){
 const secret=process.env.MARIE_WORKER_SECRET;
 if(!secret||secret.length<40||!value)return false;
 const equal=(expected:string)=>{
  const a=Buffer.from(value),b=Buffer.from(expected);
  return a.length===b.length&&timingSafeEqual(a,b);
 };
 if(equal(`Bearer ${secret}`))return true;
 if(!issuedAt||!/^\d{10}$/.test(issuedAt)||Math.abs(now/1000-Number(issuedAt))>120)return false;
 return equal(`Marie ${createHmac("sha256",secret).update(`marie-tick:${issuedAt}`).digest("hex")}`);
}
