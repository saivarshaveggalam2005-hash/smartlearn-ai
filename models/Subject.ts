import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ITopicMetrics {
  estimatedMinutes: number;
  baselineEstimatedMinutes: number;
  actualMinutesSpent: number;
  subtopicCount: number;
  hierarchyDepth: number;
  parentTopicTitle?: string;
  practiceCount: number;
  learningOutcomeCount: number;
  recommendedPomodoros: number;
  revisionsCount: number;
  difficultyScore: number;
  complexityScore?: number;
  learningFactor?: number;
  weakTopicScore: number;
  markedDifficult: boolean;
  revisionPriority: number;
  inRevisionQueue: boolean;
  quizScore?: number;
  initialDifficultyLevel?: "easy" | "medium" | "hard" | "very_hard";
  prerequisites?: string[];
  dependentTopics?: string[];
  masteryScore?: number;
  nextReviewAt?: Date;
  reviewIntervalDays?: number;
  studyTimeBreakdown?: {
    readingMinutes: number;
    understandingMinutes: number;
    practiceMinutes: number;
    quizMinutes: number;
    revisionMinutes: number;
    totalMinutes: number;
  };
}

export interface ISubtopicProgress {
  title: string;
  completed: boolean;
  skipped?: boolean;
  passed?: boolean;
  quizScore?: number;
  completedAt?: Date;
}

export interface ISyllabusSubtopic {
  title: string;
  slug: string;
  completed?: boolean;
  masteryScore?: number;
}

export interface IUnitTopic extends ITopicMetrics {
  _id?: Types.ObjectId;
  title: string;
  slug: string;
  difficulty: "easy" | "medium" | "hard";
  estimatedHours: number;
  completed: boolean;
  completionStatus: "not_started" | "in_progress" | "completed";
  isWeakTopic: boolean;
  revisionStatus: "not_started" | "in_progress" | "done";
  studyMinutes: number;
  subtopics?: ISyllabusSubtopic[];
}

export interface IUnit {
  _id?: Types.ObjectId;
  title: string;
  slug: string;
  unitLabel?: string;
  estimatedMinutes?: number;
  difficulty?: "easy" | "medium" | "hard";
  progress?: number;
  topics: IUnitTopic[];
}

export interface ITopic extends ITopicMetrics {
  _id?: Types.ObjectId;
  name: string;
  slug: string;
  unitTitle?: string;
  difficulty: "easy" | "medium" | "hard";
  estimatedHours: number;
  completed: boolean;
  completionStatus: "not_started" | "in_progress" | "completed";
  isWeakTopic: boolean;
  notes?: string;
  revisionStatus: "not_started" | "in_progress" | "done";
  content?: string;
  overview?: string;
  subtopicsList?: string[];
  keywords?: string[];
  learningObjectives?: string[];
  studyBlocks?: {
    title: string;
    description: string;
    minutes: number;
    order: number;
  }[];
  subtopicProgress?: ISubtopicProgress[];
  lastStudiedAt?: Date;
  studyMinutes: number;
}

export interface ISubject extends Document {
  userId: string;
  subjectName: string;
  slug: string;
  units: IUnit[];
  topics: ITopic[];
  progress: number;
  syllabusText?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TopicMetricsSchema = {
  estimatedMinutes: { type: Number, default: 60 },
  baselineEstimatedMinutes: { type: Number, default: 60 },
  actualMinutesSpent: { type: Number, default: 0 },
  subtopicCount: { type: Number, default: 1 },
  hierarchyDepth: { type: Number, default: 2 },
  parentTopicTitle: String,
  practiceCount: { type: Number, default: 2 },
  learningOutcomeCount: { type: Number, default: 2 },
  recommendedPomodoros: { type: Number, default: 2 },
  revisionsCount: { type: Number, default: 0 },
  difficultyScore: { type: Number, default: 45 },
  complexityScore: { type: Number, default: 45 },
  learningFactor: { type: Number, default: 1.0 },
  weakTopicScore: { type: Number, default: 0 },
  markedDifficult: { type: Boolean, default: false },
  revisionPriority: { type: Number, default: 0 },
  inRevisionQueue: { type: Boolean, default: false },
  quizScore: Number,
  initialDifficultyLevel: {
    type: String,
    enum: ["easy", "medium", "hard", "very_hard"],
  },
  prerequisites: [String],
  dependentTopics: [String],
  masteryScore: { type: Number, default: 0 },
  nextReviewAt: Date,
  reviewIntervalDays: { type: Number, default: 0 },
  studyTimeBreakdown: {
    readingMinutes: Number,
    understandingMinutes: Number,
    practiceMinutes: Number,
    quizMinutes: Number,
    revisionMinutes: Number,
    totalMinutes: Number,
  },
};

const UnitTopicSchema = new Schema<IUnitTopic>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    estimatedHours: { type: Number, default: 1 },
    completed: { type: Boolean, default: false },
    completionStatus: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "not_started",
    },
    isWeakTopic: { type: Boolean, default: false },
    revisionStatus: {
      type: String,
      enum: ["not_started", "in_progress", "done"],
      default: "not_started",
    },
    studyMinutes: { type: Number, default: 0 },
    subtopics: [
      {
        title: String,
        slug: String,
        completed: { type: Boolean, default: false },
        masteryScore: { type: Number, default: 0 },
      },
    ],
    ...TopicMetricsSchema,
  },
  { _id: true }
);

const UnitSchema = new Schema<IUnit>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true },
    unitLabel: String,
    estimatedMinutes: Number,
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
    },
    progress: { type: Number, default: 0 },
    topics: [UnitTopicSchema],
  },
  { _id: true }
);

const TopicSchema = new Schema<ITopic>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    unitTitle: String,
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    estimatedHours: { type: Number, default: 1 },
    completed: { type: Boolean, default: false },
    completionStatus: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "not_started",
    },
    isWeakTopic: { type: Boolean, default: false },
    notes: String,
    revisionStatus: {
      type: String,
      enum: ["not_started", "in_progress", "done"],
      default: "not_started",
    },
    content: String,
    overview: String,
    subtopicsList: [String],
    keywords: [String],
    learningObjectives: [String],
    studyBlocks: [
      {
        title: String,
        description: String,
        minutes: Number,
        order: Number,
      },
    ],
    subtopicProgress: [
      {
        title: String,
        completed: { type: Boolean, default: false },
        skipped: Boolean,
        passed: Boolean,
        quizScore: Number,
        completedAt: Date,
      },
    ],
    lastStudiedAt: Date,
    studyMinutes: { type: Number, default: 0 },
    ...TopicMetricsSchema,
  },
  { _id: true }
);

const SubjectSchema = new Schema<ISubject>(
  {
    userId: { type: String, required: true, index: true },
    subjectName: { type: String, required: true },
    slug: { type: String, required: true },
    units: [UnitSchema],
    topics: [TopicSchema],
    progress: { type: Number, default: 0 },
    syllabusText: String,
  },
  { timestamps: true }
);

SubjectSchema.index({ userId: 1, slug: 1 }, { unique: true });

export const Subject: Model<ISubject> =
  mongoose.models.Subject ?? mongoose.model<ISubject>("Subject", SubjectSchema);
