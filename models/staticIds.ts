import { model, Schema } from 'mongoose';

export interface IStaticIds {
  _id?: string;
  userId: string;
  employeeId: string;
}

const staticIdsSchema: Schema = new Schema<IStaticIds>(
  {
    userId: {
      type: String,
      required: true,
      unique: true
    },
    employeeId: {
      type: String,
      required: true,
      unique: true
    },
  },
  { timestamps: true }
);

const StaticIds = model<IStaticIds>('staticId', staticIdsSchema);

export default StaticIds;