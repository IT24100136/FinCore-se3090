import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import DeviceAnalyticsView from '../DeviceAnalyticsView';
import DeviceHistoryView from '../DeviceHistoryView';
import NotificationLogView from '../NotificationLogView';

// Mock Axios for backend API responses
jest.mock('axios');

describe('FinCore Admin Dashboard - Component D Suite', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // 1. Device Analytics Dashboard Tests
  describe('Device Analytics Dashboard', () => {
    test('renders summary cards with aggregated metrics correctly', () => {
      render(
        <DeviceAnalyticsView
          onViewAllFlagged={() => {}}
          onViewSessions={() => {}}
        />
      );

      // Verify Card 1: New Device Logins
      expect(screen.getByText(/New Device Logins This Week/i)).toBeInTheDocument();
      expect(screen.getByText('1,428')).toBeInTheDocument();

      // Verify Card 2: Notification Delivery Success Rate
      expect(screen.getByText(/Notification Delivery Success Rate/i)).toBeInTheDocument();
      expect(screen.getByText('98.4%')).toBeInTheDocument();

      // Verify Card 3: Flagged Users Count
      expect(screen.getByText(/Users with Multiple Flagged Devices/i)).toBeInTheDocument();
      expect(screen.getByText('14')).toBeInTheDocument();
    });
  });

  // 2. Device/Session History Viewer Tests
  describe('Device/Session History Viewer', () => {
    test('renders mocked sessions table and applies correct status badges', async () => {
      const mockedSessions = [
        {
          id: 1,
          userId: 101,
          userName: 'Kasun Perera',
          deviceFingerprint: 'fp-windows-desktop-1a2b3c',
          ipAddress: '10.0.0.42',
          location: 'Colombo, LK',
          status: 'Unverified',
          lastLoginAt: '2026-09-28T10:00:00Z'
        },
        {
          id: 2,
          userId: 102,
          userName: 'Eleanor Vance',
          deviceFingerprint: 'fp-iphone-15-pro-3c71b9',
          ipAddress: '172.56.21.90',
          location: 'New York, US',
          status: 'Verified',
          lastLoginAt: '2026-09-28T09:00:00Z'
        },
        {
          id: 3,
          userId: 103,
          userName: 'Marcus Sterling',
          deviceFingerprint: 'fp-macbook-pro-m3-8f92a1',
          ipAddress: '192.168.1.105',
          location: 'London, UK',
          status: 'Trusted',
          lastLoginAt: '2026-09-28T08:00:00Z'
        },
        {
          id: 4,
          userId: 104,
          userName: 'Sophia Chen',
          deviceFingerprint: 'fp-unrecognized-linux-77e4d2',
          ipAddress: '185.220.101.4',
          location: 'Frankfurt, DE',
          status: 'Flagged',
          lastLoginAt: '2026-09-28T07:00:00Z'
        }
      ];

      axios.get.mockResolvedValueOnce({ data: mockedSessions });

      render(<DeviceHistoryView searchQuery="" />);

      // Wait for table to load
      await waitFor(() => {
        expect(screen.getByText('Kasun Perera')).toBeInTheDocument();
      });

      // Verify all users rendered in table
      expect(screen.getByText('Eleanor Vance')).toBeInTheDocument();
      expect(screen.getByText('Marcus Sterling')).toBeInTheDocument();
      expect(screen.getByText('Sophia Chen')).toBeInTheDocument();

      // Verify status badges render with expected text & styling
      const unverifiedBadge = screen.getByText('Unverified', { selector: 'span' });
      expect(unverifiedBadge).toBeInTheDocument();
      expect(unverifiedBadge.className).toContain('bg-slate-100');

      const verifiedBadge = screen.getByText('Verified', { selector: 'span' });
      expect(verifiedBadge).toBeInTheDocument();
      expect(verifiedBadge.className).toContain('bg-blue-100');

      const trustedBadge = screen.getByText('Trusted', { selector: 'span' });
      expect(trustedBadge).toBeInTheDocument();
      expect(trustedBadge.className).toContain('bg-emerald-100');

      const flaggedBadge = screen.getByText('Flagged', { selector: 'span' });
      expect(flaggedBadge).toBeInTheDocument();
      expect(flaggedBadge.className).toContain('bg-rose-100');
    });
  });

  // 3. Notification Log Viewer Tests
  describe('Notification Log Viewer', () => {
    test('renders mocked notification history with Sent and Failed badges', async () => {
      const mockedNotificationLogs = [
        {
          id: 1,
          userId: 1,
          recipient: 'eleanor.vance@fincore-user.com',
          recipientName: 'Eleanor Vance',
          type: 'Email',
          message: 'Your FinCore security verification code is 849-201.',
          deliveryStatus: 'Sent',
          channelDetails: 'Mailgun SMTP Relay',
          latencyMs: 340,
          timestamp: '2026-09-28 16:40:00'
        },
        {
          id: 2,
          userId: 2,
          recipient: '+1 (555) 382-9102',
          recipientName: 'Marcus Sterling',
          type: 'SMS',
          message: 'FinCore Alert: Unrecognized login attempt.',
          deliveryStatus: 'Sent',
          channelDetails: 'Twilio SMS Gateway',
          latencyMs: 620,
          timestamp: '2026-09-28 16:15:00'
        },
        {
          id: 3,
          userId: 3,
          recipient: 'sophia.chen@techventures.io',
          recipientName: 'Sophia Chen',
          type: 'Email',
          message: 'Account Status Warning: Temporary restriction.',
          deliveryStatus: 'Failed',
          channelDetails: 'SendGrid API (Error 550)',
          latencyMs: 1250,
          timestamp: '2026-09-28 16:00:00'
        }
      ];

      axios.get.mockResolvedValueOnce({ data: mockedNotificationLogs });

      render(<NotificationLogView searchQuery="" />);

      // Wait for notification logs to load
      await waitFor(() => {
        expect(screen.getByText('eleanor.vance@fincore-user.com')).toBeInTheDocument();
      });

      // Verify recipient & message details
      expect(screen.getByText('+1 (555) 382-9102')).toBeInTheDocument();
      expect(screen.getByText('sophia.chen@techventures.io')).toBeInTheDocument();
      expect(screen.getByText('Your FinCore security verification code is 849-201.')).toBeInTheDocument();

      // Verify Sent and Failed status badges
      const sentBadges = screen.getAllByText('Sent', { selector: 'span' });
      expect(sentBadges.length).toBeGreaterThanOrEqual(2);
      expect(sentBadges[0].className).toContain('bg-emerald-100');

      const failedBadges = screen.getAllByText('Failed', { selector: 'span' });
      expect(failedBadges.length).toBeGreaterThanOrEqual(1);
      expect(failedBadges[0].className).toContain('bg-rose-100');
    });
  });
});
