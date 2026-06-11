import { auth, currentUser } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/db";
import { User, IUser } from "@/models/User";

export async function getAuthUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

export async function getOrCreateUser(): Promise<IUser | null> {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  await connectDB();

  let user = await User.findOne({ clerkId: clerkUser.id });

  if (!user) {
    user = await User.create({
      clerkId: clerkUser.id,
      name:
        `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() ||
        "Student",
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      onboardingCompleted: false,
    });
  }

  return user;
}

export async function requireUser(): Promise<IUser> {
  const user = await getOrCreateUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
