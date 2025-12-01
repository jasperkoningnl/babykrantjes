import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-pink-50">
      <div className="text-center px-4">
        <div className="mb-2 text-sm text-gray-500">v0.3.0-alpha</div>
        <h1 className="text-5xl font-bold mb-6 text-gray-800">
          Babykrantjes Generator
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Maak een professioneel babykrantje met alle belangrijke gegevens, 
          automatisch gegenereerde artikelen en persoonlijke foto's.
        </p>
        <Link 
          href="/wizard"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-lg text-lg transition-colors"
        >
          Start met maken
        </Link>
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-3">📝</div>
            <h3 className="font-semibold mb-2">Eenvoudig invullen</h3>
            <p className="text-sm text-gray-600">
              Doorloop een simpele wizard met alle benodigde gegevens
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="font-semibold mb-2">AI gegenereerd</h3>
            <p className="text-sm text-gray-600">
              Artikelen worden automatisch geschreven op basis van jouw input
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-3">🎨</div>
            <h3 className="font-semibold mb-2">Professioneel resultaat</h3>
            <p className="text-sm text-gray-600">
              Een prachtig babykrantje om te bewaren of te delen
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}