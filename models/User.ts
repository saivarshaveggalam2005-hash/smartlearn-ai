import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  clerkId: string;
  name: string;
  email: string;
  goal?: string;
  subjects?: string[];
  studyTime?: number;
  examDate?: Date;
  studyStyle?: string;
  weakSubjects?: string[];
  learningSpeed?: "slow" | "medium" | "fast";
  onboardingCompleted: boolean;
  streak: number;
  lastStudyDate?: Date;
  totalStudyMinutes: number;
  preferences?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    goal: String,
    subjects: [String],
    studyTime: { type: Number, default: 60 },
    examDate: Date,
    studyStyle: String,
    weakSubjects: [String],
    learningSpeed: {
      type: String,
      enum: ["slow", "medium", "fast"],
      default: "medium",
    },
    onboardingCompleted: { type: Boolean, default: false },
    streak: { type: Number, default: 0 },
    lastStudyDate: Date,
    totalStudyMinutes: { type: Number, default: 0 },
    preferences: Schema.Types.Mixed,
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);
