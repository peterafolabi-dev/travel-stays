import { Link } from 'react-router-dom'
import InfoPage, { InfoSection } from '../components/InfoPage'

export default function Terms() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Terms of"
      accent="Service"
      intro="The rules for using Travel & Stays, written in plain language. By creating an account or making a booking, you agree to these terms."
      updated="21 October 2026"
    >
      <InfoSection title="1. About Travel & Stays">
        <p>
          Travel &amp; Stays is an online marketplace that connects travellers with hosts who offer places to stay
          and local guides who offer tours. We provide the platform; hosts are responsible for their own
          listings and stays.
        </p>
      </InfoSection>

      <InfoSection title="2. Your account">
        <ul>
          <li>You must give accurate information and be at least 18 years old to book or host.</li>
          <li>Keep your password private. You are responsible for activity on your account.</li>
          <li>Each account has one role — traveller, host or tour guide — chosen when you sign up.</li>
          <li>For your security, sessions end automatically after 30 minutes of inactivity.</li>
        </ul>
      </InfoSection>

      <InfoSection title="3. Bookings">
        <ul>
          <li>
            <strong>Instant Book</strong> listings are confirmed as soon as you book. <strong>Request to book</strong>{' '}
            listings are confirmed only when the host accepts.
          </li>
          <li>Requested and confirmed dates are held exclusively for you; no other guest can book them.</li>
          <li>You must follow the listing’s house rules and not exceed the stated maximum number of guests.</li>
        </ul>
      </InfoSection>

      <InfoSection title="4. Prices, fees and payment">
        <ul>
          <li>The price shown before you book includes the nightly rate, any cleaning fee and a 10% service fee.</li>
          <li>Prices are in Nigerian naira (₦). The price is fixed at the moment you book.</li>
          <li>
            Payments are processed securely by Paystack once a booking is confirmed. Travel &amp; Stays never sees or
            stores your full card details.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="5. Cancellations and refunds">
        <p>
          Each listing has a Flexible, Moderate or Strict cancellation policy, shown on the listing before you book.
          Refunds of the nightly cost follow that policy. The service fee is non-refundable, the cleaning fee is
          refunded if you cancel before check-in, and unpaid bookings can be cancelled for free. You see the exact
          refund before you confirm a cancellation, and it reaches your card within 5–10 working days. Hosts who cancel a confirmed booking may have their listing reviewed. Full
          details are in our <Link to="/help#cancellation">cancellation options</Link>.
        </p>
      </InfoSection>

      <InfoSection title="6. Hosting">
        <ul>
          <li>Hosts must describe their place honestly, including photos, amenities, price and rules.</li>
          <li>Hosts must have the right to rent out the property and follow local laws.</li>
          <li>Verified host badges are given only after our team has reviewed identity and property documents.</li>
          <li>Hosts must respond to booking requests promptly and honour confirmed bookings.</li>
        </ul>
      </InfoSection>

      <InfoSection title="7. Things you must not do">
        <ul>
          <li>Ask for or make payments outside Travel &amp; Stays.</li>
          <li>Post false, misleading or offensive listings or content.</li>
          <li>Use someone else’s account, or try to access data that isn’t yours.</li>
          <li>Interfere with the security or normal running of the platform.</li>
        </ul>
        <p>We may suspend accounts that break these rules.</p>
      </InfoSection>

      <InfoSection title="8. Responsibility">
        <p>
          We work hard to keep Travel &amp; Stays safe and accurate, but hosts — not Travel &amp; Stays — provide the
          stays. To the extent the law allows, we are not responsible for the condition of a property or for what
          happens during a stay. Nothing in these terms limits rights you have under Nigerian consumer protection
          law.
        </p>
      </InfoSection>

      <InfoSection title="9. Changes and contact">
        <p>
          We may update these terms; the date at the top shows the latest version. Questions? <Link to="/help#contact">Contact us</Link>.
        </p>
      </InfoSection>
    </InfoPage>
  )
}
