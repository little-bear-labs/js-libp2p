import { Status } from './pb/index.js'
import type { ReservationStore as IReservationStore, ReservationStatus } from './interfaces.js'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { PeerId } from '@libp2p/interface-peer-id'

interface Reservation {
  addr: Multiaddr
  expire: Date
}

export class ReservationStore implements IReservationStore {
  private readonly reservations = new Map<string, Reservation>()
  private serviceInterval: NodeJS.Timer | number | undefined

  constructor (private readonly limit = 15, private readonly reservationClearIntervalMs = 5 * 60 * 1000) {
  }

  private async clearStaleReservations () {
    const now = new Date()
    const deleteSet = []
    for (const [peerID, reservation] of this.reservations.entries()) {
      if (reservation.expire <= now) {
        deleteSet.push(peerID)
      }
    }
    deleteSet.forEach((peerID) => this.reservations.delete(peerID))
  }

  async reserve (peer: PeerId, addr: Multiaddr): Promise<{status: ReservationStatus, expire?: bigint}> {
    if (this.reservations.size >= this.limit && !this.reservations.has(peer.toString())) {
      return { status: Status.RESERVATION_REFUSED, expire: undefined }
    }
    const expire = new Date()
    expire.setHours(expire.getHours() + 12)
    this.reservations.set(peer.toString(), { addr, expire })
    return { status: Status.OK, expire: BigInt(expire.getTime()) }
  }

  async removeReservation (peer: PeerId) {
    this.reservations.delete(peer.toString())
  }

  async hasReservation (dst: PeerId) {
    return this.reservations.has(dst.toString())
  }

  start () {
    this.serviceInterval = setInterval(async () => await this.clearStaleReservations(), this.reservationClearIntervalMs)
  }

  stop () {
    if (this.serviceInterval) {
      clearInterval(this.serviceInterval)
    }
  }
}
