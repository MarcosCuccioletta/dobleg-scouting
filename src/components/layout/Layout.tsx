import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import AIAnalystChat from '@/components/chat/AIAnalystChat'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-apple-gray-50 dark:bg-apple-gray-900 text-apple-gray-800 dark:text-apple-gray-100 transition-colors duration-300 ease-apple">
      <Navbar />
      <main className="flex-1 animate-fade-in">
        <Outlet />
      </main>
      <Footer />
      <AIAnalystChat />
    </div>
  )
}
