import { MongoServerError, type Collection, type Db } from "mongodb";

export class AlreadyReserved extends Error {}
export class NoSuchReservation extends Error {}

interface Reservation {
  _id: string;
  user: string;
  resource: string;
}

export class ReservingConcept {
  private readonly reservations: Collection<Reservation>;
  private indexed = false;

  constructor(db: Db) {
    this.reservations = db.collection<Reservation>("reserving.reservations");
  }

  async reserve({ user, resource }: { user: string; resource: string }) {
    if (!this.indexed) {
      // The unique index stops a resource from being reserved twice.
      await this.reservations.createIndex({ resource: 1 }, { unique: true });
      this.indexed = true;
    }
    const reservation = crypto.randomUUID();
    try {
      await this.reservations.insertOne({ _id: reservation, user, resource });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new AlreadyReserved("That resource is already reserved.");
      }
      throw error;
    }
    return { reservation };
  }

  async cancel({ reservation }: { reservation: string }) {
    const result = await this.reservations.deleteOne({ _id: reservation });
    if (result.deletedCount === 0) {
      throw new NoSuchReservation("There is no such reservation.");
    }
    return { reservation };
  }

  async _all(_input: Record<string, never>) {
    const rows = await this.reservations.find().sort({ resource: 1 }).toArray();
    return rows.map(({ _id, user, resource }) => ({ reservation: _id, user, resource }));
  }
}
