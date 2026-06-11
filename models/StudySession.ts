import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStudySession extends Document {
  userId: string;
  subjectId: string;
  topicId: string;
  topicName: string;
  duration: number;
  sessionStartedAt?: Date;
  sessionEndedAt?: Date;
  estimatedMinutesAtStart?: number;
  quizScore?: number;
  completedAt?: Date;
  notesGenerated?: string;
  pomodoroSessions: number;
  createdAt: Date;
  updatedAt: Date;
}

const StudySessionSchema = new Schema<IStudySession>(
  {
    userId: { type: String, required: true, index: true },
    subjectId: { type: String, required: true },
    topicId: { type: String, required: true },
    topicName: { type: String, required: true },
    duration: { type: Number, default: 0 },
    sessionStartedAt: Date,
    sessionEndedAt: Date,
    estimatedMinutesAtStart: Number,
    quizScore: Number,
    completedAt: Date,
    notesGenerated: String,
    pomodoroSessions: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const StudySession: Model<IStudySession> =
  mongoose.models.StudySession ??
  mongoose.model<IStudySession>("StudySession", StudySessionSchema);
