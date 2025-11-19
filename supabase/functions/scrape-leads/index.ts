import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  website?: string;
  url?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  business_status?: string;
}

async function searchPlaces(
  query: string,
  location: string,
  apiKey: string,
  maxResults: number
): Promise<PlaceResult[]> {
  const results: PlaceResult[] = [];
  let nextPageToken: string | undefined;

  // First, get geocode for the location
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`;
  const geocodeResponse = await fetch(geocodeUrl);
  const geocodeData = await geocodeResponse.json();

  if (!geocodeData.results || geocodeData.results.length === 0) {
    throw new Error(`Localização não encontrada: ${location}`);
  }

  const { lat, lng } = geocodeData.results[0].geometry.location;

  // Search for places
  while (results.length < maxResults) {
    let searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=50000&key=${apiKey}&language=pt-BR`;

    if (nextPageToken) {
      searchUrl += `&pagetoken=${nextPageToken}`;
      // Google requires a short delay before using pagetoken
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
      console.error('Places API error:', searchData.status, searchData.error_message);
      break;
    }

    if (!searchData.results || searchData.results.length === 0) {
      break;
    }

    // Get details for each place
    for (const place of searchData.results) {
      if (results.length >= maxResults) break;

      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,url,rating,user_ratings_total,types,business_status&key=${apiKey}&language=pt-BR`;

        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();

        if (detailsData.status === 'OK' && detailsData.result) {
          results.push({
            place_id: place.place_id,
            ...detailsData.result
          });
        }
      } catch (error) {
        console.error('Error fetching place details:', error);
        // Add basic info even if details fail
        results.push({
          place_id: place.place_id,
          name: place.name,
          formatted_address: place.formatted_address,
          url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
        });
      }
    }

    nextPageToken = searchData.next_page_token;
    if (!nextPageToken) break;
  }

  return results;
}

function extractCityAndUF(address: string, defaultCity: string, defaultUF: string): { city: string; uf: string } {
  // Try to extract city and UF from address
  // Format: "Rua X, 123 - Bairro, Cidade - UF, CEP, Brasil"
  const parts = address.split(',');

  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].trim();

    // Look for UF pattern (2 uppercase letters)
    const ufMatch = part.match(/\b([A-Z]{2})\b/);
    if (ufMatch) {
      // The city is usually before the UF
      const cityPart = part.split('-')[0]?.trim() || parts[i - 1]?.split('-').pop()?.trim();
      return {
        city: cityPart || defaultCity,
        uf: ufMatch[1]
      };
    }
  }

  return { city: defaultCity, uf: defaultUF };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { niche, city, uf, max_results } = await req.json();

    console.log('Iniciando scraping:', { niche, city, uf, max_results });

    const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');

    // If no API key, return mock data
    if (!GOOGLE_PLACES_API_KEY) {
      console.log('GOOGLE_PLACES_API_KEY não configurada - retornando dados mock');

      const mockLeads = Array.from({ length: parseInt(max_results) }, (_, i) => ({
        source: `google_maps_${uf.toLowerCase()}`,
        business_name: `${niche} ${city} ${i + 1}`,
        maps_url: `https://maps.google.com/maps?cid=${Math.random().toString(36).substr(2, 9)}`,
        website: Math.random() > 0.3 ? `https://exemplo${i + 1}.com.br` : '',
        phone: `(${['21', '11', '31', '41', '51'][Math.floor(Math.random() * 5)]}) 9${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
        address: `Rua ${['das Flores', 'Principal', 'Central', 'da Praia', 'dos Médicos'][Math.floor(Math.random() * 5)]}, ${Math.floor(100 + Math.random() * 900)}`,
        city: city,
        uf: uf,
        raw_description: `${niche} especializada em ${['estética facial', 'estética corporal', 'dermatologia', 'harmonização', 'laser', 'tratamentos premium'][Math.floor(Math.random() * 6)]}. ${Math.random() > 0.5 ? 'Atendimento personalizado.' : ''} ${Math.random() > 0.5 ? `${Math.floor(50 + Math.random() * 200)} avaliações.` : ''}`,
        status_processamento: ''
      }));

      return new Response(
        JSON.stringify(mockLeads),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Google Places API for real data
    const searchQuery = `${niche} em ${city} ${uf}`;
    const location = `${city}, ${uf}, Brasil`;

    console.log('Buscando:', searchQuery, 'em', location);

    const places = await searchPlaces(searchQuery, location, GOOGLE_PLACES_API_KEY, parseInt(max_results));

    const leads = places.map(place => {
      const { city: extractedCity, uf: extractedUF } = extractCityAndUF(
        place.formatted_address || '',
        city,
        uf
      );

      // Build description from available data
      let description = '';
      if (place.types && place.types.length > 0) {
        description = place.types
          .filter(t => !['point_of_interest', 'establishment'].includes(t))
          .slice(0, 3)
          .join(', ');
      }
      if (place.rating) {
        description += ` | Avaliação: ${place.rating}/5`;
      }
      if (place.user_ratings_total) {
        description += ` (${place.user_ratings_total} avaliações)`;
      }

      return {
        source: `google_places_${uf.toLowerCase()}`,
        business_name: place.name || '',
        maps_url: place.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
        website: place.website || '',
        phone: place.formatted_phone_number || '',
        address: place.formatted_address || '',
        city: extractedCity,
        uf: extractedUF,
        raw_description: description || niche,
        status_processamento: ''
      };
    });

    console.log(`Scraping concluído: ${leads.length} leads encontrados`);

    return new Response(
      JSON.stringify(leads),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função scrape-leads:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
