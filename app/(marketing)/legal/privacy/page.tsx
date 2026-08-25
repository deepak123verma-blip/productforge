export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p>
        We collect what's needed to run the product: your email, purchase history, and — for creators — identity
        details our payment processor requires for verification and payouts. Payment card details never touch our
        servers; they go directly to Stripe.
      </p>
      <p>
        Delivery events (when a purchased file was downloaded, from a hashed IP) are logged as proof of delivery.
        IP addresses are stored only as salted hashes. We don't sell personal data.
      </p>
      <h2>Your rights</h2>
      <p>Draft clause — data access, deletion, retention periods, and processor list to be settled with counsel.</p>
    </>
  );
}
