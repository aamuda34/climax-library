// Import Supabase client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Your actual project URL and anon key
const SUPABASE_URL = "https://tgerdrdangqrbffjxdbb.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZXJkcmRhbmdxcmJmZmp4ZGJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NDgxNjUsImV4cCI6MjEwNDMyNDE2NX0.DjWbXXei1lzSDilHc06BS8Yd02jgZqkVAPuhzOCTP1w"

// Create client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Fetch books by class level
async function fetchBooks(classLevel) {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('class_level', classLevel)

  if (error) {
    console.error("Error fetching books:", error)
    return []
  }
  return data
}

async function loadBooks() {
  const level = document.getElementById("classLevel").value
  const books = await fetchBooks(level)
  const container = document.getElementById("books")
  container.innerHTML = ""
  books.forEach(book => {
    const div = document.createElement("div")
    div.innerHTML = `
      <h3>${book.title}</h3>
      <img src="${book.cover_url}" alt="${book.title}" width="120"/>
      <p><a href="${book.pdf_url}" target="_blank">Read PDF</a></p>
    `
    container.appendChild(div)
  })
}
