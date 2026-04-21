// // src/lib/prisma.ts
// // Singleton Prisma Client untuk Prisma 6+ dengan adapter pg (Supabase)
// import { PrismaClient } from "../generated/prisma/index.js";
// import { PrismaPg } from "@prisma/adapter-pg";
// import { Pool } from "pg";
// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
// });
// const adapter = new PrismaPg(pool);
// const globalForPrisma = globalThis as unknown as {
//   prisma: PrismaClient | undefined;
// };
// export const prisma =
//   globalForPrisma.prisma ??
//   new PrismaClient({
//     adapter,
//     log:
//       process.env.NODE_ENV === "development"
//         ? ["query", "error", "warn"]
//         : ["error"],
//   });
// if (process.env.NODE_ENV !== "production") {
//   globalForPrisma.prisma = prisma;
// }
// export default prisma;
// src/lib/prisma.ts
import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const globalForPrisma = globalThis;
// reuse pool yang sama — jangan buat pool baru tiap request
if (!globalForPrisma.pool) {
    globalForPrisma.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 1, // penting untuk serverless — batasi 1 koneksi per instance
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
    });
}
if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg(globalForPrisma.pool);
    globalForPrisma.prisma = new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development"
            ? ["query", "error", "warn"]
            : ["error"],
    });
}
export const prisma = globalForPrisma.prisma;
export default prisma;
