import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDailyProgress {
  date: string;
  minutes: number;
  topicsCompleted: number;
}

export interface IRevisionQueueEntry {
  topicId: string;
  subjectSlug: string;
  subjectName: string;
  topicName: string;
  priority: number;
  reason: "weak_topic" | "incomplete" | "marked_difficult" | "overdue";
  addedAt: Date;
}

export interface IProgress extends Document {
  userId: string;
  completedTopics: string[];
  studyHours: number;
  completedStudyHours: number;
  streak: number;
  lastStudyDate?: Date;
  totalStudyMinutes: number;
  weakAreas: string[];
  dailyLog: IDailyProgress[];
  performanceScore: number;
  learningPaceMultiplier: number;
  fastCompletions: number;
  slowCompletions: number;
  incompleteSessions: number;
  revisionQueue: IRevisionQueueEntry[];
  learningFactor: number;
  averageQuizScore: number;
  averageCompletionRate: number;
  averageStudyTimeRatio: number;
  weakTopics: string[];
  strongTopics: string[];
  sessionsTracked: number;
  xp: number;
  level: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProgressSchema = new Schema<IProgress>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    completedTopics: [String],
    studyHours: { type: Number, default: 0 },
    completedStudyHours: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    lastStudyDate: Date,
    totalStudyMinutes: { type: Number, default: 0 },
    weakAreas: [String],
    dailyLog: [
      {
        date: String,
        minutes: Number,
        topicsCompleted: Number,
      },
    ],
    performanceScore: { type: Number, default: 0 },
    learningPaceMultiplier: { type: Number, default: 1 },
    fastCompletions: { type: Number, default: 0 },
    slowCompletions: { type: Number, default: 0 },
    incompleteSessions: { type: Number, default: 0 },
    revisionQueue: [
      {
        topicId: String,
        subjectSlug: String,
        subjectName: String,
        topicName: String,
        priority: { type: Number, default: 50 },
        reason: {
          type: String,
          enum: ["weak_topic", "incomplete", "marked_difficult", "overdue"],
        },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    learningFactor: { type: Number, default: 1.0 },
    averageQuizScore: { type: Number, default: 0 },
    averageCompletionRate: { type: Number, default: 0 },
    averageStudyTimeRatio: { type: Number, default: 1.0 },
    weakTopics: [String],
    strongTopics: [String],
    sessionsTracked: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const Progress: Model<IProgress> =
  mongoose.models.Progress ??
  mongoose.model<IProgress>("Progress", ProgressSchema);
