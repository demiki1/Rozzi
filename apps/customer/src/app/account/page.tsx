'use client';

import {
  FormEvent,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  api,
  logout as clearSession,
} from '../../lib/api';

type Profile = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  marketingNotificationsEnabled?: boolean;
  orderNotificationsEnabled?: boolean;
  promotionalNotificationsEnabled?: boolean;
  createdAt?: string;
};

type Address = {
  id: string;
  label: string;
  addressText: string;
  landmark?: string | null;
  instructions?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
};

type AddressForm = {
  label: string;
  addressText: string;
  landmark: string;
  instructions: string;
  isDefault: boolean;
};

type ReferralReward = {
  id: string;
  amount: number;
  status: string;
  eligibleAt?: string | null;
  holdUntil?: string | null;
  creditedAt?: string | null;
};

type ReferralRecord = {
  id: string;
  referralCode: string;
  status: string;
  qualifyingAmount?: number | null;
  rewardAmount?: number | null;
  registeredAt?: string | null;
  qualifiedAt?: string | null;
  deliveredAt?: string | null;
  verifiedAt?: string | null;
  rewardedAt?: string | null;
  referredUser?: {
    id: string;
    fullName: string;
  } | null;
  reward?: ReferralReward | null;
};

type ReferralDashboard = {
  referralCode: string;
  referralLink: string;
  stats: {
    totalReferrals: number;
    successfulReferrals: number;
    pendingReferrals: number;
    totalEarned: number;
    pendingCredits: number;
  };
  referrals: ReferralRecord[];
};

function formatMoneyKobo(value = 0) {
  return `₦${(Number(value) / 100).toLocaleString('en-NG', {
    maximumFractionDigits: 0,
  })}`;
}

function referralStatusLabel(status: string) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const emptyAddress: AddressForm = {
  label: '',
  addressText: '',
  landmark: '',
  instructions: '',
  isDefault: false,
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function formatDate(value?: string) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default function AccountPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);

  const [referralDashboard, setReferralDashboard] =
    useState<ReferralDashboard | null>(null);
  const [referralError, setReferralError] = useState('');

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] =
    useState<string | null>(null);
  const [addressForm, setAddressForm] =
    useState<AddressForm>(emptyAddress);

  async function loadAccount() {
    setError('');

    try {
      const currentToken =
        typeof window !== 'undefined'
          ? localStorage.getItem('rozzi_token')
          : null;

      if (!currentToken) {
        router.replace('/login');
        return;
      }

      const [profileData, addressData] = await Promise.all([
        api<Profile>('/api/account/profile'),
        api<Address[]>('/api/account/addresses'),
      ]);

      setProfile(profileData);
      setAddresses(addressData);

      setProfileName(profileData.fullName || '');
      setProfilePhone(profileData.phone || '');

      try {
        const referralData = await api<ReferralDashboard>(
          '/api/referrals/mine',
        );
        setReferralDashboard(referralData);
        setReferralError('');
      } catch (referralException: any) {
        setReferralDashboard(null);
        setReferralError(
          referralException?.message ||
            'Unable to load your referral information.',
        );
      }
    } catch (e: any) {
      const message = String(e?.message || '');

      if (
        message.toLowerCase().includes('unauthorized') ||
        message.toLowerCase().includes('session') ||
        message.includes('(401)')
      ) {
        router.replace('/login');
        return;
      }

      setError(
        message || 'Unable to load your account. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccount();
  }, []);

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (profileName.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }

    setSavingProfile(true);
    setError('');
    setNotice('');

    try {
      const updated = await api<Profile>('/api/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: profileName.trim(),
          phone: profilePhone.trim(),
        }),
      });

      setProfile(updated);
      setProfileName(updated.fullName || '');
      setProfilePhone(updated.phone || '');
      setEditingProfile(false);
      setNotice('Your profile has been updated.');
    } catch (e: any) {
      setError(
        e?.message || 'Unable to update your profile.',
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function updateSetting(
    field:
      | 'marketingNotificationsEnabled'
      | 'orderNotificationsEnabled'
      | 'promotionalNotificationsEnabled',
    value: boolean,
  ) {
    setSavingSettings(true);
    setError('');
    setNotice('');

    try {
      const updated = await api<Profile>(
        '/api/account/settings',
        {
          method: 'PATCH',
          body: JSON.stringify({
            [field]: value,
          }),
        },
      );

      setProfile((current) =>
        current
          ? {
              ...current,
              ...updated,
            }
          : updated,
      );

      setNotice('Notification settings updated.');
    } catch (e: any) {
      setError(
        e?.message || 'Unable to update notification settings.',
      );
    } finally {
      setSavingSettings(false);
    }
  }

  function startAddAddress() {
    setEditingAddressId(null);
    setAddressForm(emptyAddress);
    setShowAddressForm(true);
    setError('');
    setNotice('');
  }

  function startEditAddress(address: Address) {
    setEditingAddressId(address.id);
    setAddressForm({
      label: address.label || '',
      addressText: address.addressText || '',
      landmark: address.landmark || '',
      instructions: address.instructions || '',
      isDefault: address.isDefault,
    });
    setShowAddressForm(true);
    setError('');
    setNotice('');
  }

  function cancelAddressForm() {
    setShowAddressForm(false);
    setEditingAddressId(null);
    setAddressForm(emptyAddress);
  }

  async function saveAddress(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (addressForm.label.trim().length < 2) {
      setError('Please give this address a label.');
      return;
    }

    if (addressForm.addressText.trim().length < 5) {
      setError('Please enter a complete delivery address.');
      return;
    }

    setSavingAddress(true);
    setError('');
    setNotice('');

    try {
      if (editingAddressId) {
        const updated = await api<Address>(
          `/api/account/addresses/${editingAddressId}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              label: addressForm.label.trim(),
              addressText: addressForm.addressText.trim(),
              landmark: addressForm.landmark.trim(),
              instructions: addressForm.instructions.trim(),
              isDefault: addressForm.isDefault,
            }),
          },
        );

        setAddresses((current) => {
          const next = addressForm.isDefault
            ? current.map((item) => ({
                ...item,
                isDefault: item.id === updated.id,
              }))
            : current;

          return next.map((item) =>
            item.id === updated.id ? updated : item,
          );
        });

        setNotice('Address updated.');
      } else {
        const created = await api<Address>(
          '/api/account/addresses',
          {
            method: 'POST',
            body: JSON.stringify({
              label: addressForm.label.trim(),
              addressText: addressForm.addressText.trim(),
              landmark: addressForm.landmark.trim(),
              instructions: addressForm.instructions.trim(),
              isDefault: addressForm.isDefault,
            }),
          },
        );

        setAddresses((current) => {
          const next = addressForm.isDefault
            ? current.map((item) => ({
                ...item,
                isDefault: false,
              }))
            : current;

          return [...next, created];
        });

        setNotice('Address added.');
      }

      cancelAddressForm();
    } catch (e: any) {
      setError(
        e?.message || 'Unable to save this address.',
      );
    } finally {
      setSavingAddress(false);
    }
  }

  async function makeDefault(addressId: string) {
    setError('');
    setNotice('');

    try {
      await api(
        `/api/account/addresses/${addressId}/default`,
        {
          method: 'POST',
        },
      );

      setAddresses((current) =>
        current.map((item) => ({
          ...item,
          isDefault: item.id === addressId,
        })),
      );

      setNotice('Default delivery address updated.');
    } catch (e: any) {
      setError(
        e?.message || 'Unable to change the default address.',
      );
    }
  }

  async function deleteAddress(addressId: string) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this address?',
    );

    if (!confirmed) return;

    setError('');
    setNotice('');

    try {
      await api(
        `/api/account/addresses/${addressId}`,
        {
          method: 'DELETE',
        },
      );

      setAddresses((current) =>
        current.filter((item) => item.id !== addressId),
      );

      setNotice('Address deleted.');
    } catch (e: any) {
      setError(
        e?.message || 'Unable to delete this address.',
      );
    }
  }

  function signOut() {
    clearSession();
    router.replace('/login');
  }

  if (loading) {
    return (
      <main className="account-page">
        <div className="account-loading">
          <div className="account-spinner" />
          <p>Loading your ROZZI account...</p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="account-page">
        <div className="account-error-card">
          <h1>Unable to load account</h1>
          <p>
            {error || 'We could not load your account information.'}
          </p>

          <button
            className="btn"
            type="button"
            onClick={loadAccount}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="account-page">
      <header className="account-header">
        <div className="account-header-inner">
          <Link href="/" className="account-logo">
            <img
              src="/rozzi-logo.png"
              alt="ROZZI"
            />
          </Link>

          <nav className="account-header-nav">
            <Link href="/">Shop</Link>
            <Link href="/orders">Orders</Link>
            <Link href="/cart">Cart</Link>
          </nav>

          <button
            type="button"
            className="account-signout"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="account-container">
        <div className="account-title-row">
          <div>
            <span className="account-eyebrow">
              MY ROZZI
            </span>

            <h1>Account</h1>

            <p>
              Manage your profile, delivery addresses and preferences.
            </p>
          </div>
        </div>

        {error && (
          <div className="account-alert account-alert-error">
            {error}
          </div>
        )}

        {notice && (
          <div className="account-alert account-alert-success">
            {notice}
          </div>
        )}

        <section className="account-profile-card">
          <div className="account-avatar">
            {initials(profile.fullName)}
          </div>

          <div className="account-profile-main">
            <span className="account-profile-label">
              Customer
            </span>

            <h2>{profile.fullName}</h2>

            <p>
              {profile.email ||
                profile.phone ||
                'ROZZI customer'}
            </p>
          </div>

          <button
            type="button"
            className="account-secondary-btn"
            onClick={() => {
              setEditingProfile((value) => !value);
              setError('');
              setNotice('');
            }}
          >
            {editingProfile ? 'Cancel' : 'Edit profile'}
          </button>
        </section>

        <div className="account-grid">
          <section className="account-card account-card-wide">
            <div className="account-card-heading">
              <div>
                <span className="account-section-kicker">
                  PROFILE
                </span>
                <h2>Personal information</h2>
              </div>
            </div>

            {editingProfile ? (
              <form
                className="account-form"
                onSubmit={saveProfile}
              >
                <label>
                  Full name
                  <input
                    className="account-input"
                    value={profileName}
                    onChange={(e) =>
                      setProfileName(e.target.value)
                    }
                    maxLength={80}
                    required
                  />
                </label>

                <label>
                  Email address
                  <input
                    className="account-input account-input-disabled"
                    value={profile.email || ''}
                    disabled
                  />
                  <small>
                    Your login email cannot be changed here.
                  </small>
                </label>

                <label>
                  Phone number
                  <input
                    className="account-input"
                    value={profilePhone}
                    onChange={(e) =>
                      setProfilePhone(e.target.value)
                    }
                    placeholder="+234..."
                  />
                </label>

                <div className="account-form-actions">
                  <button
                    className="account-primary-btn"
                    type="submit"
                    disabled={savingProfile}
                  >
                    {savingProfile
                      ? 'Saving...'
                      : 'Save changes'}
                  </button>

                  <button
                    className="account-secondary-btn"
                    type="button"
                    onClick={() =>
                      setEditingProfile(false)
                    }
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="account-details">
                <div>
                  <span>Full name</span>
                  <strong>{profile.fullName}</strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>
                    {profile.email || 'Not provided'}
                  </strong>
                </div>

                <div>
                  <span>Phone</span>
                  <strong>
                    {profile.phone || 'Not provided'}
                  </strong>
                </div>

                <div>
                  <span>Member since</span>
                  <strong>
                    {formatDate(profile.createdAt)}
                  </strong>
                </div>
              </div>
            )}
          </section>

          <section className="account-card">
            <div className="account-card-heading">
              <div>
                <span className="account-section-kicker">
                  PREFERENCES
                </span>
                <h2>Notifications</h2>
              </div>
            </div>

            <div className="account-settings">
              <label className="account-setting">
                <span>
                  <strong>Order updates</strong>
                  <small>
                    Delivery and order status notifications.
                  </small>
                </span>

                <input
                  type="checkbox"
                  checked={
                    profile.orderNotificationsEnabled ?? true
                  }
                  disabled={savingSettings}
                  onChange={(e) =>
                    updateSetting(
                      'orderNotificationsEnabled',
                      e.target.checked,
                    )
                  }
                />
              </label>

              <label className="account-setting">
                <span>
                  <strong>Promotions</strong>
                  <small>
                    Offers, discounts and ROZZI promotions.
                  </small>
                </span>

                <input
                  type="checkbox"
                  checked={
                    profile.promotionalNotificationsEnabled ??
                    true
                  }
                  disabled={savingSettings}
                  onChange={(e) =>
                    updateSetting(
                      'promotionalNotificationsEnabled',
                      e.target.checked,
                    )
                  }
                />
              </label>

              <label className="account-setting">
                <span>
                  <strong>Marketing</strong>
                  <small>
                    News and useful ROZZI updates.
                  </small>
                </span>

                <input
                  type="checkbox"
                  checked={
                    profile.marketingNotificationsEnabled ??
                    true
                  }
                  disabled={savingSettings}
                  onChange={(e) =>
                    updateSetting(
                      'marketingNotificationsEnabled',
                      e.target.checked,
                    )
                  }
                />
              </label>
            </div>
          </section>

          <section className="account-card account-card-wide">
            <div className="account-card-heading">
              <div>
                <span className="account-section-kicker">
                  DELIVERY
                </span>
                <h2>Delivery addresses</h2>
                <p>
                  Save addresses for faster checkout.
                </p>
              </div>

              <button
                type="button"
                className="account-primary-btn"
                onClick={startAddAddress}
              >
                + Add address
              </button>
            </div>

            {showAddressForm && (
              <form
                className="address-form"
                onSubmit={saveAddress}
              >
                <div className="address-form-title">
                  <h3>
                    {editingAddressId
                      ? 'Edit address'
                      : 'Add delivery address'}
                  </h3>

                  <button
                    type="button"
                    className="address-close"
                    onClick={cancelAddressForm}
                    aria-label="Close address form"
                  >
                    ×
                  </button>
                </div>

                <div className="account-form-grid">
                  <label>
                    Address label
                    <input
                      className="account-input"
                      value={addressForm.label}
                      onChange={(e) =>
                        setAddressForm((current) => ({
                          ...current,
                          label: e.target.value,
                        }))
                      }
                      placeholder="Home, School, Office..."
                      maxLength={40}
                      required
                    />
                  </label>

                  <label>
                    Delivery address
                    <input
                      className="account-input"
                      value={addressForm.addressText}
                      onChange={(e) =>
                        setAddressForm((current) => ({
                          ...current,
                          addressText: e.target.value,
                        }))
                      }
                      placeholder="Enter your full address"
                      maxLength={240}
                      required
                    />
                  </label>
                </div>

                <label>
                  Landmark
                  <input
                    className="account-input"
                    value={addressForm.landmark}
                    onChange={(e) =>
                      setAddressForm((current) => ({
                        ...current,
                        landmark: e.target.value,
                      }))
                    }
                    placeholder="Nearby landmark"
                    maxLength={120}
                  />
                </label>

                <label>
                  Delivery instructions
                  <textarea
                    className="account-input account-textarea"
                    value={addressForm.instructions}
                    onChange={(e) =>
                      setAddressForm((current) => ({
                        ...current,
                        instructions: e.target.value,
                      }))
                    }
                    placeholder="Anything the rider should know?"
                    maxLength={500}
                    rows={3}
                  />
                </label>

                <label className="account-checkbox">
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault}
                    onChange={(e) =>
                      setAddressForm((current) => ({
                        ...current,
                        isDefault: e.target.checked,
                      }))
                    }
                  />
                  <span>Make this my default address</span>
                </label>

                <div className="account-form-actions">
                  <button
                    className="account-primary-btn"
                    type="submit"
                    disabled={savingAddress}
                  >
                    {savingAddress
                      ? 'Saving...'
                      : editingAddressId
                        ? 'Save address'
                        : 'Add address'}
                  </button>

                  <button
                    type="button"
                    className="account-secondary-btn"
                    onClick={cancelAddressForm}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {addresses.length === 0 && !showAddressForm ? (
              <div className="account-empty">
                <div className="account-empty-icon">
                  +
                </div>
                <h3>No delivery addresses yet</h3>
                <p>
                  Add an address to make your next ROZZI order
                  faster.
                </p>
                <button
                  type="button"
                  className="account-primary-btn"
                  onClick={startAddAddress}
                >
                  Add your first address
                </button>
              </div>
            ) : (
              <div className="address-list">
                {addresses.map((address) => (
                  <article
                    className={`address-item ${
                      address.isDefault
                        ? 'address-item-default'
                        : ''
                    }`}
                    key={address.id}
                  >
                    <div className="address-main">
                      <div className="address-title">
                        <h3>{address.label}</h3>

                        {address.isDefault && (
                          <span className="default-badge">
                            Default
                          </span>
                        )}
                      </div>

                      <p>{address.addressText}</p>

                      {address.landmark && (
                        <span>
                          Landmark: {address.landmark}
                        </span>
                      )}

                      {address.instructions && (
                        <span>
                          Note: {address.instructions}
                        </span>
                      )}
                    </div>

                    <div className="address-actions">
                      {!address.isDefault && (
                        <button
                          type="button"
                          onClick={() =>
                            makeDefault(address.id)
                          }
                        >
                          Make default
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          startEditAddress(address)
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="danger-action"
                        onClick={() =>
                          deleteAddress(address.id)
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section id="refer-and-earn" className="account-card account-card-wide referral-card">
            <div className="account-card-heading">
              <div>
                <span className="account-section-kicker">
                  REFER & EARN
                </span>
                <h2>Invite friends. Earn ROZZI Credits.</h2>
                <p>
                  Refer a genuinely new ROZZI customer and earn a one-time
                  reward when their first qualifying order is completed and
                  verified.
                </p>
              </div>
            </div>

            {referralError ? (
              <div className="account-alert account-alert-error">
                {referralError}
              </div>
            ) : referralDashboard ? (
              <>
                <div className="account-referral-stats">
                  <div>
                    <span>Total referrals</span>
                    <strong>{referralDashboard.stats.totalReferrals}</strong>
                  </div>
                  <div>
                    <span>Eligible referrals</span>
                    <strong>{referralDashboard.stats.successfulReferrals}</strong>
                  </div>
                  <div>
                    <span>Pending referrals</span>
                    <strong>{referralDashboard.stats.pendingReferrals}</strong>
                  </div>
                  <div>
                    <span>ROZZI Credits earned</span>
                    <strong>{formatMoneyKobo(referralDashboard.stats.totalEarned)}</strong>
                  </div>
                </div>

                <div className="account-referral-share">
                  <div>
                    <span>Your referral code</span>
                    <strong>{referralDashboard.referralCode}</strong>
                  </div>
                  <div>
                    <span>Pending ROZZI Credits</span>
                    <strong>{formatMoneyKobo(referralDashboard.stats.pendingCredits)}</strong>
                  </div>
                  <button
                    type="button"
                    className="account-primary-btn"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          referralDashboard.referralLink,
                        );
                        setNotice('Referral link copied to your clipboard.');
                        setError('');
                      } catch {
                        setError('Unable to copy the referral link.');
                        setNotice('');
                      }
                    }}
                  >
                    Copy referral link
                  </button>
                </div>

                <div className="account-referral-rules">
                  <strong>How it works</strong>
                  <span>
                    Your friend must register through your referral, then
                    complete one qualifying transaction of at least ₦5,000.
                    The reward is one-time only and is credited as ROZZI
                    Credits after verification.
                  </span>
                </div>

                {referralDashboard.referrals.length > 0 && (
                  <div className="account-referral-history">
                    <div className="account-referral-history-title">
                      <span>Referral history</span>
                      <strong>{referralDashboard.referrals.length} referrals</strong>
                    </div>

                    {referralDashboard.referrals.slice(0, 5).map((referral) => (
                      <div className="account-referral-row" key={referral.id}>
                        <div>
                          <strong>
                            {referral.referredUser?.fullName || 'Referred customer'}
                          </strong>
                          <span>
                            {formatDate(referral.registeredAt || undefined)}
                          </span>
                        </div>
                        <div>
                          <span className="account-referral-status">
                            {referralStatusLabel(referral.status)}
                          </span>
                          <strong>
                            {formatMoneyKobo(referral.rewardAmount || 0)}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="account-empty">
                <h3>Refer friends and earn</h3>
                <p>Loading your referral details...</p>
              </div>
            )}
          </section>

          <section className="account-card">
            <div className="account-card-heading">
              <div>
                <span className="account-section-kicker">
                  ROZZI
                </span>
                <h2>More from ROZZI</h2>
              </div>
            </div>

            <div className="account-links">
              <Link href="/orders">
                <span>Orders</span>
                <span>→</span>
              </Link>

              <Link href="/favorites">
                <span>Favorites</span>
                <span>→</span>
              </Link>

              <Link href="/wallet">
                <span>ROZZI Wallet</span>
                <span>→</span>
              </Link>

              <Link href="/payments">
                <span>Payments</span>
                <span>→</span>
              </Link>

              <Link href="/reviews">
                <span>My Reviews</span>
                <span>→</span>
              </Link>

              <Link href="/refunds">
                <span>Refunds</span>
                <span>→</span>
              </Link>

              <a href="#refer-and-earn">
                <span>Refer & Earn</span>
                <span>→</span>
              </a>

              <Link href="/support">
                <span>Support</span>
                <span>→</span>
              </Link>
            </div>
          </section>

          <section className="account-card account-danger-card">
            <span className="account-section-kicker">
              ACCOUNT
            </span>

            <h2>Sign out</h2>

            <p>
              Sign out of this ROZZI customer account on this
              device.
            </p>

            <button
              type="button"
              className="account-danger-btn"
              onClick={signOut}
            >
              Sign out
            </button>
          </section>
        </div>
      </div>

      <style jsx>{`
        .referral-card { position: relative; overflow: hidden; }
        .referral-card::before { content: ''; position: absolute; inset: 0 0 auto; height: 4px; background: linear-gradient(90deg, #7b1e2b, #f28c28, #d7a72b); }
        .account-referral-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
        .account-referral-stats > div, .account-referral-share > div { border: 1px solid rgba(123,30,43,.12); border-radius: 14px; padding: 15px 16px; background: #fffaf4; }
        .account-referral-stats span, .account-referral-share span { display: block; color: #806f67; font-size: 12px; margin-bottom: 6px; }
        .account-referral-stats strong { display: block; color: #5e1722; font-size: 22px; line-height: 1.1; }
        .account-referral-share { display: grid; grid-template-columns: 1.2fr 1fr auto; gap: 12px; align-items: stretch; margin-top: 12px; }
        .account-referral-share strong { display: block; color: #35191b; }
        .account-referral-share .account-primary-btn { align-self: stretch; white-space: nowrap; }
        .account-referral-rules { display: flex; gap: 10px; margin-top: 14px; padding: 14px 16px; border-radius: 14px; background: #f9f1e7; color: #6d5a52; font-size: 13px; line-height: 1.55; }
        .account-referral-rules strong { color: #5e1722; white-space: nowrap; }
        .account-referral-history { margin-top: 18px; border-top: 1px solid rgba(123,30,43,.1); }
        .account-referral-history-title, .account-referral-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .account-referral-history-title { padding: 16px 0 10px; }
        .account-referral-history-title span { font-weight: 700; color: #35191b; }
        .account-referral-history-title strong { font-size: 12px; color: #806f67; }
        .account-referral-row { padding: 13px 0; border-top: 1px solid rgba(123,30,43,.08); }
        .account-referral-row > div { display: flex; flex-direction: column; gap: 4px; }
        .account-referral-row > div:last-child { align-items: flex-end; }
        .account-referral-row strong { color: #35191b; }
        .account-referral-row span { color: #806f67; font-size: 12px; }
        .account-referral-status { display: inline-flex !important; width: fit-content; padding: 4px 8px; border-radius: 999px; background: #f7eadb; color: #7b1e2b !important; font-weight: 700; font-size: 11px !important; }
        @media (max-width: 900px) { .account-referral-stats { grid-template-columns: repeat(2, minmax(0,1fr)); } .account-referral-share { grid-template-columns: 1fr 1fr; } .account-referral-share .account-primary-btn { grid-column: 1 / -1; } }
        @media (max-width: 600px) { .account-referral-stats, .account-referral-share { grid-template-columns: 1fr; } .account-referral-rules { flex-direction: column; } .account-referral-row { align-items: flex-start; } .account-referral-row > div:last-child { align-items: flex-end; text-align: right; } }
      `}</style>
    </main>
  );
}