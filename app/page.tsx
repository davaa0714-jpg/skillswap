"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col justify-center items-center p-6 text-center">
      {/* Hero Section */}
      <section className="max-w-3xl mb-16">
        <h1 className="text-5xl font-extrabold text-blue-700 mb-4">
          SkillSwap 🚀
        </h1>
        <p className="text-lg text-gray-700 mb-6">
          “Би чамд X заана, чи надад Y заа” – Ур чадвараа солилцож суралцах хамгийн хялбар арга.
        </p>
        <Link
          href="/auth"
          className="px-8 py-3 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition"
        >
          Start Learning
        </Link>
      </section>

      {/* Features */}
      <section className="max-w-4xl mb-16">
        <h2 className="text-3xl font-bold text-blue-700 mb-6">Features</h2>
        <div className="grid md:grid-cols-3 gap-6 text-left">
          <div className="p-4 bg-white rounded shadow hover:shadow-lg transition">
            <h3 className="font-semibold text-lg mb-2">Profile</h3>
            <p>Бүртгүүлээд өөрийн нэр, ур чадвар, сурахыг хүссэн зүйлээ оруулна.</p>
          </div>
          <div className="p-4 bg-white rounded shadow hover:shadow-lg transition">
            <h3 className="font-semibold text-lg mb-2">Match</h3>
            <p>Таны ур чадвар ↔ бусдын хүссэн ур чадвар таарч, автомат match болно.</p>
          </div>
          <div className="p-4 bg-white rounded shadow hover:shadow-lg transition">
            <h3 className="font-semibold text-lg mb-2">Chat</h3>
            <p>Realtime chat ашиглан сургалтын session-уудыг амжилттай эхлүүлнэ.</p>
          </div>
        </div>
      </section>

      {/* Demo Flow */}
      <section className="max-w-3xl mb-16">
        <h2 className="text-3xl font-bold text-blue-700 mb-6">Demo Flow</h2>
        <ol className="list-decimal list-inside text-left text-gray-700 space-y-2">
          <li>Register / Login</li>
          <li>Profile бөглөх</li>
          <li>Find Match</li>
          <li>Request Match</li>
          <li>Chat эхлүүлэх</li>
        </ol>
      </section>

      {/* CTA */}
      <section className="mb-12">
        <Link
          href="/register"
          className="px-10 py-4 bg-green-600 text-white font-bold rounded hover:bg-green-700 transition text-lg"
        >
          Get Started Now
        </Link>
      </section>

      <footer className="text-gray-400 text-sm">
        &copy; {new Date().getFullYear()} SkillSwap. Demo Version.
      </footer>
    </main>
  );
}
