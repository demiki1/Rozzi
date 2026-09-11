import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrderStateMachine } from '../../src/modules/orders/order-state-machine';

describe('OrderStateMachine', () => {
  let machine: OrderStateMachine;

  beforeEach(() => {
    machine = new OrderStateMachine();
  });

  describe('assertValidTransition', () => {
    it('allows the documented happy path for a full delivery order', () => {
      const happyPath: OrderStatus[] = [
        OrderStatus.PENDING_PAYMENT,
        OrderStatus.PAID,
        OrderStatus.PENDING_VENDOR,
        OrderStatus.ACCEPTED,
        OrderStatus.PREPARING,
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.RIDER_SEARCHING,
        OrderStatus.RIDER_ASSIGNED,
        OrderStatus.RIDER_ARRIVED_PICKUP,
        OrderStatus.PICKED_UP,
        OrderStatus.IN_TRANSIT,
        OrderStatus.RIDER_ARRIVED,
        OrderStatus.DELIVERED,
      ];

      for (let i = 0; i < happyPath.length - 1; i++) {
        expect(() => machine.assertValidTransition(happyPath[i], happyPath[i + 1])).not.toThrow();
      }
    });

    it('allows the pickup-order shortcut (READY_FOR_PICKUP -> DELIVERED, skipping every rider state)', () => {
      expect(() =>
        machine.assertValidTransition(OrderStatus.READY_FOR_PICKUP, OrderStatus.DELIVERED),
      ).not.toThrow();
    });

    it('rejects skipping a required step (PAID straight to ACCEPTED, bypassing PENDING_VENDOR)', () => {
      expect(() => machine.assertValidTransition(OrderStatus.PAID, OrderStatus.ACCEPTED)).toThrow(
        BadRequestException,
      );
    });

    it('rejects any transition out of a terminal state', () => {
      const terminalStates: OrderStatus[] = [
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        OrderStatus.FAILED,
        OrderStatus.REFUNDED,
      ];
      for (const terminal of terminalStates) {
        expect(() => machine.assertValidTransition(terminal, OrderStatus.PENDING_VENDOR)).toThrow(
          BadRequestException,
        );
      }
    });

    it('rejects reviving a cancelled order back to an active state', () => {
      expect(() => machine.assertValidTransition(OrderStatus.CANCELLED, OrderStatus.ACCEPTED)).toThrow(
        BadRequestException,
      );
    });

    it('allows cancellation from every state that supports it, up through READY_FOR_PICKUP', () => {
      const cancellableStates: OrderStatus[] = [
        OrderStatus.PENDING_PAYMENT,
        OrderStatus.PAID,
        OrderStatus.PENDING_VENDOR,
        OrderStatus.ACCEPTED,
        OrderStatus.PREPARING,
        OrderStatus.READY_FOR_PICKUP,
      ];
      for (const state of cancellableStates) {
        expect(() => machine.assertValidTransition(state, OrderStatus.CANCELLED)).not.toThrow();
      }
    });

    it('allows reassignment from RIDER_ASSIGNED back to RIDER_SEARCHING (admin reassign)', () => {
      expect(() =>
        machine.assertValidTransition(OrderStatus.RIDER_ASSIGNED, OrderStatus.RIDER_SEARCHING),
      ).not.toThrow();
    });

    it('includes the allowed next states in the error message so a caller can self-correct', () => {
      try {
        machine.assertValidTransition(OrderStatus.DELIVERED, OrderStatus.CANCELLED);
        fail('expected assertValidTransition to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toContain('terminal state');
      }
    });
  });

  describe('isTerminal', () => {
    it.each([OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.FAILED, OrderStatus.REFUNDED])(
      '%s is terminal',
      (status) => {
        expect(machine.isTerminal(status)).toBe(true);
      },
    );

    it.each([OrderStatus.PENDING_PAYMENT, OrderStatus.ACCEPTED, OrderStatus.IN_TRANSIT])(
      '%s is not terminal',
      (status) => {
        expect(machine.isTerminal(status)).toBe(false);
      },
    );
  });

  describe('isFreelyCancellableByCustomer', () => {
    it('allows self-cancellation before vendor acceptance', () => {
      expect(machine.isFreelyCancellableByCustomer(OrderStatus.PENDING_PAYMENT)).toBe(true);
      expect(machine.isFreelyCancellableByCustomer(OrderStatus.PAID)).toBe(true);
      expect(machine.isFreelyCancellableByCustomer(OrderStatus.PENDING_VENDOR)).toBe(true);
    });

    it('blocks self-cancellation once the vendor has accepted the order', () => {
      expect(machine.isFreelyCancellableByCustomer(OrderStatus.ACCEPTED)).toBe(false);
      expect(machine.isFreelyCancellableByCustomer(OrderStatus.PREPARING)).toBe(false);
      expect(machine.isFreelyCancellableByCustomer(OrderStatus.IN_TRANSIT)).toBe(false);
    });
  });
});
