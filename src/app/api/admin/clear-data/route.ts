import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const [
      statusChanges,
      votes,
      donations,
      lobbying,
      promises,
      bills,
      donors,
      politicians,
    ] = await prisma.$transaction([
      prisma.promiseStatusChange.deleteMany(),
      prisma.vote.deleteMany(),
      prisma.donation.deleteMany(),
      prisma.lobbyingRecord.deleteMany(),
      prisma.promise.deleteMany(),
      prisma.bill.deleteMany(),
      prisma.donor.deleteMany(),
      prisma.politician.deleteMany(),
    ]);

    return NextResponse.json({
      success: true,
      deleted: {
        statusChanges: statusChanges.count,
        votes: votes.count,
        donations: donations.count,
        lobbyingRecords: lobbying.count,
        promises: promises.count,
        bills: bills.count,
        donors: donors.count,
        politicians: politicians.count,
      },
    });
  } catch (err) {
    console.error("Clear data error:", err);
    return NextResponse.json(
      { error: "Failed to clear data" },
      { status: 500 }
    );
  }
}
