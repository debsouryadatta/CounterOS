import bcrypt from "bcryptjs";
import { createDefaultWorkspaceForUser } from "@/lib/db/seed-workspace";
import { createUser, findUserByEmail } from "@/lib/db/queries";

async function main() {
  const email = (process.env.SEED_USER_EMAIL ?? "founder@example.com").toLowerCase();
  const password = process.env.SEED_USER_PASSWORD ?? "counterless-demo";
  const name = "Demo Founder";

  let user = findUserByEmail(email);

  if (!user) {
    const passwordHash = await bcrypt.hash(password, 12);
    user = createUser({
      email,
      name,
      passwordHash
    });
  }

  createDefaultWorkspaceForUser(user.id, user.email, user.name);

  console.log(`Seeded Counterless demo user: ${email}`);
  console.log(`Demo password: ${password}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
