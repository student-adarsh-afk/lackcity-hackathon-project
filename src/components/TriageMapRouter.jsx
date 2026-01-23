import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'

export default function TriageMapRouter({ triageResult, isDarkMode = false }) {
  const mapRef = useRef(null)
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const directionsRendererRef = useRef(null)

  const [userLocation, setUserLocation] = useState(null)
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [directions, setDirections] = useState(null)
  const [routeInfo, setRouteInfo] = useState(null)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false)
  const [sortBy, setSortBy] = useState('distance')
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  
  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false)
  const [travelMode, setTravelMode] = useState('DRIVING')
  const [liveLocation, setLiveLocation] = useState(null)
  const watchIdRef = useRef(null)
  const userMarkerRef = useRef(null)

  // Sort options
  const sortOptions = [
    { value: 'distance', label: 'Distance', icon: '📍' },
    { value: 'rating', label: 'Rating', icon: '⭐' },
  ]

  // Get sorted places based on selected sort option
  const getSortedPlaces = () => {
    if (!places.length) return places
    
    let sorted = [...places]
    switch (sortBy) {
      case 'distance':
        sorted.sort((a, b) => a.distance - b.distance)
        break
      case 'rating':
        sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0))
        break
      default:
        break
    }
    return sorted
  }

  const sortedPlaces = getSortedPlaces()

  // Dark mode theme helpers
  const panelBgClass = isDarkMode ? 'bg-neutral-950' : 'bg-white'
  const panelTextClass = isDarkMode ? 'text-white' : 'text-gray-900'
  const panelSubtextClass = isDarkMode ? 'text-white/60' : 'text-gray-500'
  const cardBgClass = isDarkMode ? 'bg-neutral-900' : 'bg-gray-50'
  const cardHoverClass = isDarkMode ? 'hover:bg-neutral-800' : 'hover:bg-gray-100'
  const buttonBgClass = isDarkMode ? 'bg-black hover:bg-neutral-900 ring-1 ring-white/10' : 'bg-sky-500 hover:bg-sky-400'
  const ringNeutral = isDarkMode ? 'ring-white/10' : 'ring-gray-200'
  const borderClass = isDarkMode ? 'border-white/10' : 'border-gray-200'

  const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

  // Get search radius based on urgency
  const getSearchRadius = () => {
    switch (triageResult?.urgency) {
      case 'emergency': return 20000
      case 'urgent': return 15000
      default: return 10000
    }
  }

  // Get urgency colors
  const getUrgencyColor = () => {
    switch (triageResult?.urgency) {
      case 'emergency': return { bg: 'bg-red-500', ring: 'ring-red-500/30' }
      case 'urgent': return { bg: 'bg-orange-500', ring: 'ring-orange-500/30' }
      default: return { bg: 'bg-green-500', ring: 'ring-green-500/30' }
    }
  }

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Calculate ranking score
  const calculateScore = (place, distanceKm) => {
    const distanceScore = 5 / Math.max(distanceKm, 0.1)
    const ratingScore = place.rating || 3
    const popularityBonus = (place.user_ratings_total || 0) > 50 ? 1 : 0
    return distanceScore + ratingScore + popularityBonus
  }

  // Load Google Maps and get user location
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) {
      setError('Google Maps API key is not configured')
      setLoading(false)
      return
    }

    // Load Google Maps script
    const loadGoogleMaps = () => {
      return new Promise((resolve, reject) => {
        if (window.google?.maps) {
          resolve()
          return
        }

        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`
        script.async = true
        script.onload = resolve
        script.onerror = () => reject(new Error('Failed to load Google Maps'))
        document.head.appendChild(script)
      })
    }

    // Get user location
    const getUserLocation = () => {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve({ lat: 28.6139, lng: 77.2090 }) // Default Delhi
          return
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            })
          },
          () => {
            resolve({ lat: 28.6139, lng: 77.2090 }) // Default Delhi on error
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        )
      })
    }

    // Initialize everything
    const init = async () => {
      try {
        await loadGoogleMaps()
        const location = await getUserLocation()
        setUserLocation(location)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }

    init()
  }, [GOOGLE_MAPS_KEY])

  // Initialize map and search when we have location
  useEffect(() => {
    if (!userLocation || !window.google?.maps || !mapRef.current || !triageResult) return

    // Dark mode map styles
    const darkModeStyles = [
      { elementType: "geometry", stylers: [{ color: "#212121" }] },
      { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
      { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
      { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
      { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
      { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
      { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
      { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
      { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
      { featureType: "poi.park", elementType: "labels.text.stroke", stylers: [{ color: "#1b1b1b" }] },
      { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
      { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
      { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#4e4e4e" }] },
      { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
      { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] },
    ]

    // Create map
    const map = new window.google.maps.Map(mapRef.current, {
      center: userLocation,
      zoom: 13,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      styles: isDarkMode ? darkModeStyles : [],
    })

    mapInstanceRef.current = map

    // Add user marker
    new window.google.maps.Marker({
      position: userLocation,
      map: map,
      title: 'Your Location',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
    })

    // Search for places
    const service = new window.google.maps.places.PlacesService(map)
    const radius = getSearchRadius()

    // Build search query
    const keywords = triageResult.search_keywords || []
    const query = [...keywords, triageResult.department, 'hospital'].filter(Boolean).join(' ')

    const request = {
      location: new window.google.maps.LatLng(userLocation.lat, userLocation.lng),
      radius: radius,
      query: query || 'hospital near me',
    }

    service.textSearch(request, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
        processResults(results, map)
      } else {
        // Fallback: nearby search for hospitals
        service.nearbySearch({
          location: new window.google.maps.LatLng(userLocation.lat, userLocation.lng),
          radius: radius,
          type: 'hospital',
        }, (nearbyResults, nearbyStatus) => {
          if (nearbyStatus === window.google.maps.places.PlacesServiceStatus.OK && nearbyResults) {
            processResults(nearbyResults, map)
          } else {
            setError('No hospitals found nearby')
            setLoading(false)
          }
        })
      }
    })

    function processResults(results, map) {
      // Clear old markers
      markersRef.current.forEach(m => m.setMap(null))
      markersRef.current = []

      const service = new window.google.maps.places.PlacesService(map)

      // Calculate scores and sort
      const initialScored = results
        .filter(p => p.geometry?.location)
        .map(place => {
          const lat = place.geometry.location.lat()
          const lng = place.geometry.location.lng()
          const distance = calculateDistance(userLocation.lat, userLocation.lng, lat, lng)
          const score = calculateScore(place, distance)
          return { ...place, distance, score, isOpen: null }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, triageResult?.urgency === 'emergency' ? 6 : 8) // Get a few extra to filter

      // Fetch details for each place to get open/closed status
      const detailsPromises = initialScored.map(place => {
        return new Promise((resolve) => {
          service.getDetails(
            { placeId: place.place_id, fields: ['opening_hours', 'formatted_phone_number', 'business_status', 'utc_offset_minutes', 'website', 'url'] },
            (details, status) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && details) {
                let isOpen = null
                
                // Only set isOpen if we have actual opening_hours data with isOpen method
                if (details.opening_hours && typeof details.opening_hours.isOpen === 'function') {
                  try {
                    isOpen = details.opening_hours.isOpen()
                  } catch (e) {
                    isOpen = null
                  }
                }
                
                resolve({
                  ...place,
                  isOpen: isOpen,
                  formatted_phone_number: details.formatted_phone_number || null,
                  business_status: details.business_status,
                  website: details.website || null,
                  url: details.url || null // Google Maps URL
                })
              } else {
                resolve({ ...place, isOpen: null })
              }
            }
          )
        })
      })

      Promise.all(detailsPromises).then(placesWithDetails => {
        // Sort and filter with open/closed info
        const finalPlaces = placesWithDetails
          .sort((a, b) => {
            if (triageResult?.urgency === 'emergency') {
              if (a.isOpen === true && b.isOpen !== true) return -1
              if (b.isOpen === true && a.isOpen !== true) return 1
            }
            if (a.isOpen === true && b.isOpen === false) return -1
            if (a.isOpen === false && b.isOpen === true) return 1
            return b.score - a.score
          })
          .filter(place => {
            if (triageResult?.urgency === 'emergency') {
              return place.isOpen !== false
            }
            return true
          })
          .slice(0, triageResult?.urgency === 'emergency' ? 3 : 5)

        setPlaces(finalPlaces)

        // Add markers
        const bounds = new window.google.maps.LatLngBounds()
        bounds.extend(userLocation)

        finalPlaces.forEach((place, index) => {
          const marker = new window.google.maps.Marker({
            position: place.geometry.location,
            map: map,
            title: place.name,
            label: {
              text: String(index + 1),
              color: '#ffffff',
              fontWeight: 'bold',
            },
          })

          bounds.extend(place.geometry.location)

          const infoWindow = new window.google.maps.InfoWindow({
            content: `<div style="color:#000;padding:8px"><strong>${place.name}</strong><br/>${place.vicinity || ''}</div>`
          })

          marker.addListener('click', () => {
            infoWindow.open(map, marker)
            setSelectedPlace(place)
          })

          markersRef.current.push(marker)
        })

        map.fitBounds(bounds, 50)
        setLoading(false)
      })
    }

  }, [userLocation, triageResult, isDarkMode])

  // Show directions on map
  const showDirections = (place) => {
    if (!mapInstanceRef.current || !userLocation) return

    const directionsService = new window.google.maps.DirectionsService()

    // Create or reuse directions renderer
    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: mapInstanceRef.current,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#3b82f6',
          strokeWeight: 5,
          strokeOpacity: 0.8,
        },
      })
    }

    const request = {
      origin: new window.google.maps.LatLng(userLocation.lat, userLocation.lng),
      destination: place.geometry.location,
      travelMode: window.google.maps.TravelMode.DRIVING,
    }

    directionsService.route(request, (result, status) => {
      if (status === window.google.maps.DirectionsStatus.OK) {
        directionsRendererRef.current.setDirections(result)
        setDirections(result)
        setSelectedPlace(place)

        // Extract route info
        const route = result.routes[0]
        const leg = route.legs[0]
        setRouteInfo({
          distance: leg.distance.text,
          duration: leg.duration.text,
          steps: leg.steps.map(step => ({
            instruction: step.instructions,
            distance: step.distance.text,
          })),
        })
      }
    })
  }

  // Clear directions from map
  const clearDirections = () => {
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] })
    }
    setDirections(null)
    setRouteInfo(null)
    stopNavigation()
  }

  // Start live navigation
  const startNavigation = () => {
    if (!selectedPlace || !navigator.geolocation) {
      console.error('Navigation not available')
      return
    }

    setIsNavigating(true)

    // Create user marker if it doesn't exist
    if (!userMarkerRef.current && mapInstanceRef.current) {
      userMarkerRef.current = new window.google.maps.Marker({
        map: mapInstanceRef.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        zIndex: 999,
      })
    }

    // Watch position with high accuracy
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setLiveLocation(newLocation)

        // Update user marker position
        if (userMarkerRef.current) {
          userMarkerRef.current.setPosition(newLocation)
        }

        // Center map on user with navigation tilt
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(newLocation)
          mapInstanceRef.current.setZoom(17)
        }

        // Update directions from new location
        if (selectedPlace) {
          showDirections(selectedPlace, newLocation, travelMode)
        }
      },
      (error) => {
        console.error('Geolocation error:', error)
        setError('Unable to track location. Please enable GPS.')
        stopNavigation()
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  // Stop live navigation
  const stopNavigation = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null)
      userMarkerRef.current = null
    }
    setIsNavigating(false)
    setLiveLocation(null)
    
    // Reset map zoom
    if (mapInstanceRef.current && userLocation) {
      mapInstanceRef.current.setZoom(13)
    }
  }

  // Cleanup navigation on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  // Update directions when travel mode changes during navigation
  useEffect(() => {
    if (isNavigating && selectedPlace && liveLocation) {
      showDirections(selectedPlace, liveLocation, travelMode)
    }
  }, [travelMode])

  const urgencyColors = getUrgencyColor()

  if (!triageResult) {
    return (
      <motion.div 
        className="flex h-screen flex-col items-center justify-center bg-slate-950 text-white px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div 
          className="rounded-2xl bg-slate-900 p-6 sm:p-8 text-center ring-1 ring-white/10 max-w-sm w-full"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.h2 
            className="text-lg sm:text-xl font-semibold text-white mb-3 sm:mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            No Triage Result
          </motion.h2>
          <motion.p 
            className="text-white/60 mb-5 sm:mb-6 text-sm sm:text-base"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Please describe your symptoms first.
          </motion.p>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link to="/interaction" className="rounded-xl bg-sky-500 px-5 sm:px-6 py-2.5 sm:py-3 text-sm font-medium text-white hover:bg-sky-400 inline-block">
              Go to Symptom Checker
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className={`relative flex flex-col lg:flex-row h-screen ${isDarkMode ? 'bg-neutral-900' : 'bg-gray-100'}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Emergency Banner */}
      <AnimatePresence>
        {triageResult.urgency === 'emergency' && (
          <motion.div 
            className="absolute left-0 right-0 top-0 z-50 bg-red-600 px-3 sm:px-4 py-2 sm:py-3 text-center text-white"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.span 
              className="font-bold text-xs sm:text-sm"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              ⚠️ EMERGENCY: Visit the nearest hospital immediately!
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Side Panel - Hidden on mobile */}
      <motion.div 
        className={`hidden lg:block w-96 overflow-y-auto shadow-lg ${panelBgClass} ${triageResult.urgency === 'emergency' ? 'pt-14' : ''}`}
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={`border-b ${borderClass} p-4`}>
          <h2 className={`text-xl font-semibold ${panelTextClass}`}>Recommended Facilities</h2>
          <div className="mt-2 flex items-center gap-2">
            <motion.span 
              className={`rounded-full px-3 py-1 text-xs font-medium text-white ${urgencyColors.bg}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, delay: 0.3 }}
            >
              {triageResult.urgency?.toUpperCase()}
            </motion.span>
            <span className={`text-sm ${panelSubtextClass}`}>
              {triageResult.specialist} • {triageResult.department}
            </span>
          </div>
        </div>

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div 
              className="flex flex-col items-center justify-center p-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div 
                className="h-10 w-10 rounded-full border-4 border-sky-500 border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <p className={`mt-4 ${panelSubtextClass}`}>Searching nearby facilities...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && !loading && (
            <motion.div 
              className="m-4 rounded-xl bg-red-100 p-4 text-red-600"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {!loading && places.length > 0 && (
            <motion.div 
              className="p-4 space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {sortedPlaces.map((place, index) => (
                <motion.div
                  key={place.place_id}
                  className={`rounded-xl ${cardBgClass} p-4 ring-1 cursor-pointer ${cardHoverClass} transition-all ${
                    selectedPlace?.place_id === place.place_id ? `ring-2 ${urgencyColors.ring}` : ringNeutral
                  }`}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ scale: 1.02, x: 4 }}
                  onClick={() => {
                    setSelectedPlace(place)
                    mapInstanceRef.current?.panTo(place.geometry.location)
                    mapInstanceRef.current?.setZoom(15)
                  }}
                >
                  {/* Open/Closed tag in top right */}
                  <div className="flex justify-end mb-2">
                    {place.isOpen === true && (
                      <motion.span 
                        className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-600"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.2 }}
                      >
                        Open
                      </motion.span>
                    )}
                    {place.isOpen === false && (
                      <motion.span 
                        className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-600"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.2 }}
                      >
                        Closed
                      </motion.span>
                    )}
                    {place.isOpen === null && (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                        Hours N/A
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <motion.div 
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${urgencyColors.bg}`}
                      whileHover={{ scale: 1.1 }}
                    >
                      {index + 1}
                    </motion.div>
                    <div className="flex-1">
                      <h3 className={`font-semibold ${panelTextClass}`}>{place.name}</h3>
                      <p className={`text-xs ${panelSubtextClass}`}>{place.vicinity || place.formatted_address}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    {place.rating && (
                      <span className="text-yellow-600">⭐ {place.rating.toFixed(1)}</span>
                    )}
                    <span className={panelSubtextClass}>📍 {place.distance.toFixed(1)} km</span>
                  </div>

                  {/* Dynamic button: Get Directions -> Start Navigation -> Stop Navigation */}
                  {selectedPlace?.place_id === place.place_id && routeInfo ? (
                    !isNavigating ? (
                      <motion.button
                        onClick={(e) => { e.stopPropagation(); startNavigation() }}
                        className="mt-3 w-full rounded-lg py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg shadow-green-500/30"
                        whileHover={{ scale: 1.02, boxShadow: "0 10px 30px -5px rgba(34, 197, 94, 0.4)" }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Start Navigation
                      </motion.button>
                    ) : (
                      <motion.button
                        onClick={(e) => { e.stopPropagation(); stopNavigation() }}
                        className="mt-3 w-full rounded-lg py-2 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-rose-500 shadow-lg shadow-red-500/30"
                        whileHover={{ scale: 1.02, boxShadow: "0 10px 30px -5px rgba(239, 68, 68, 0.4)" }}
                        whileTap={{ scale: 0.98 }}
                      >
                        ⏹ Stop Navigation
                      </motion.button>
                    )
                  ) : (
                    <motion.button
                      onClick={(e) => { e.stopPropagation(); showDirections(place) }}
                      className={`mt-3 w-full rounded-lg py-2 text-sm font-medium text-white ${buttonBgClass}`}
                      whileHover={{ scale: 1.02, boxShadow: "0 5px 20px -5px rgba(14, 165, 233, 0.4)" }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Get Directions
                    </motion.button>
                  )}

                  {/* Book Appointment Section */}
                  <div className={`mt-3 pt-3 border-t ${borderClass}`}>
                    <p className={`text-xs font-medium mb-2 ${panelSubtextClass}`}>Book Appointment</p>
                    {(place.formatted_phone_number || place.website || place.url) ? (
                      <div className="flex flex-wrap gap-2">
                        {place.formatted_phone_number && (
                          <motion.a
                            href={`tel:${place.formatted_phone_number}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isDarkMode ? 'bg-green-900/50 text-green-400 hover:bg-green-900/70' : 'bg-green-100 text-green-700 hover:bg-green-200'} transition-colors`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            📞 Call Now
                          </motion.a>
                        )}
                        {place.website && (
                          <motion.a
                            href={place.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isDarkMode ? 'bg-blue-900/50 text-blue-400 hover:bg-blue-900/70' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'} transition-colors`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            🌐 Visit Website
                          </motion.a>
                        )}
                        {place.url && (
                          <motion.a
                            href={place.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isDarkMode ? 'bg-purple-900/50 text-purple-400 hover:bg-purple-900/70' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'} transition-colors`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            🧾 Book via Google
                          </motion.a>
                        )}
                      </div>
                    ) : (
                      <p className={`text-xs italic ${panelSubtextClass}`}>
                        Please contact the hospital reception for appointment.
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Directions Panel */}
        <AnimatePresence>
          {routeInfo && (
            <motion.div 
              className={`border-t ${borderClass} p-4`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-medium ${panelTextClass}`}>Directions to {selectedPlace?.name}</h3>
                <motion.button
                  onClick={clearDirections}
                  className={`text-xs ${panelSubtextClass} hover:text-gray-600`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕ Clear
                </motion.button>
              </div>

              {/* Travel Mode Selector */}
              <div className="flex gap-2 mb-3">
                <motion.button
                  onClick={() => {
                    setTravelMode('DRIVING')
                    if (!isNavigating && selectedPlace) showDirections(selectedPlace, null, 'DRIVING')
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    travelMode === 'DRIVING'
                      ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                      : isDarkMode ? 'bg-neutral-800 text-white/70 hover:bg-neutral-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  🚗 Car
                </motion.button>
                <motion.button
                  onClick={() => {
                    setTravelMode('BICYCLING')
                    if (!isNavigating && selectedPlace) showDirections(selectedPlace, null, 'BICYCLING')
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    travelMode === 'BICYCLING'
                      ? isDarkMode ? 'bg-green-600 text-white' : 'bg-green-500 text-white'
                      : isDarkMode ? 'bg-neutral-800 text-white/70 hover:bg-neutral-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  🚴 Bike
                </motion.button>
                <motion.button
                  onClick={() => {
                    setTravelMode('WALKING')
                    if (!isNavigating && selectedPlace) showDirections(selectedPlace, null, 'WALKING')
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    travelMode === 'WALKING'
                      ? isDarkMode ? 'bg-orange-600 text-white' : 'bg-orange-500 text-white'
                      : isDarkMode ? 'bg-neutral-800 text-white/70 hover:bg-neutral-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  🚶 Walk
                </motion.button>
              </div>
              
              <div className="flex gap-4 mb-4">
                <motion.div 
                  className={`rounded-lg px-3 py-2 text-center flex-1 ${isDarkMode ? 'bg-neutral-800' : 'bg-sky-100'}`}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <p className="text-lg font-bold text-sky-600">{routeInfo.distance}</p>
                  <p className={`text-xs ${panelSubtextClass}`}>Distance</p>
                </motion.div>
                <motion.div 
                  className={`rounded-lg px-3 py-2 text-center flex-1 ${isDarkMode ? 'bg-neutral-800' : 'bg-green-100'}`}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <p className="text-lg font-bold text-green-600">{routeInfo.duration}</p>
                  <p className={`text-xs ${panelSubtextClass}`}>Duration</p>
                </motion.div>
              </div>

              {/* Start/Stop Navigation Button */}
              {!isNavigating ? (
                <motion.button
                  onClick={startNavigation}
                  className="w-full mb-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-500/30"
                  whileHover={{ scale: 1.02, boxShadow: "0 10px 30px -5px rgba(34, 197, 94, 0.4)" }}
                  whileTap={{ scale: 0.98 }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Start Navigation
                </motion.button>
              ) : (
                <motion.button
                  onClick={stopNavigation}
                  className="w-full mb-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-500/30"
                  whileHover={{ scale: 1.02, boxShadow: "0 10px 30px -5px rgba(239, 68, 68, 0.4)" }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  Stop Navigation
                </motion.button>
              )}

              {/* Live Navigation Indicator */}
              {isNavigating && (
                <motion.div 
                  className={`mb-4 p-3 rounded-xl flex items-center gap-3 ${isDarkMode ? 'bg-blue-900/30 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <motion.div 
                    className="w-3 h-3 rounded-full bg-blue-500"
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <div>
                    <p className={`text-sm font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>Live Navigation Active</p>
                    <p className={`text-xs ${isDarkMode ? 'text-blue-400/70' : 'text-blue-600'}`}>Following your location • {travelMode === 'DRIVING' ? '🚗 Driving' : travelMode === 'BICYCLING' ? '🚴 Cycling' : '🚶 Walking'}</p>
                  </div>
                </motion.div>
              )}

              <div className="max-h-48 overflow-y-auto space-y-2">
                {routeInfo.steps.map((step, idx) => (
                  <motion.div 
                    key={idx} 
                    className="flex gap-2 text-xs"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * idx }}
                  >
                    <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-neutral-800 text-white/70' : 'bg-gray-100 text-gray-500'}`}>
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <p className={isDarkMode ? 'text-white/80' : 'text-gray-700'} dangerouslySetInnerHTML={{ __html: step.instruction }} />
                      <p className={panelSubtextClass}>{step.distance}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Triage Summary */}
        <motion.div 
          className={`border-t ${borderClass} p-4`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className={`mb-3 text-sm font-medium ${panelSubtextClass}`}>Triage Summary</h3>
          <div className="space-y-2 text-sm">
            <motion.div 
              className="flex justify-between"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <span className={panelSubtextClass}>Specialist</span>
              <span className="text-indigo-600">{triageResult.specialist}</span>
            </motion.div>
            <motion.div 
              className="flex justify-between"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
            >
              <span className={panelSubtextClass}>Department</span>
              <span className="text-sky-600">{triageResult.department}</span>
            </motion.div>
            <motion.div 
              className="flex justify-between"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
            >
              <span className={panelSubtextClass}>Search Radius</span>
              <span className={isDarkMode ? 'text-white/80' : 'text-gray-700'}>{getSearchRadius() / 1000} km</span>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>

      {/* Map */}
      <motion.div 
        ref={mapContainerRef}
        className={`flex-1 relative ${triageResult.urgency === 'emergency' ? 'pt-10 sm:pt-12' : ''}`}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <div ref={mapRef} className="h-full w-full" />
        
        {/* Sort By Dropdown - Top Left */}
        <div className="absolute top-4 left-4 z-10">
          <div className="relative">
            <motion.button
              onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg backdrop-blur-md text-sm font-medium transition-colors ${
                isDarkMode 
                  ? 'bg-black/80 text-white ring-1 ring-white/10 hover:bg-black/90' 
                  : 'bg-white/90 text-gray-700 ring-1 ring-black/5 hover:bg-white'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span>{sortOptions.find(o => o.value === sortBy)?.icon}</span>
              <span>Sort by: {sortOptions.find(o => o.value === sortBy)?.label}</span>
              <svg 
                className={`w-4 h-4 transition-transform ${sortDropdownOpen ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </motion.button>
            
            <AnimatePresence>
              {sortDropdownOpen && (
                <motion.div
                  className={`absolute top-full left-0 mt-2 w-48 rounded-xl shadow-2xl overflow-hidden ${
                    isDarkMode ? 'bg-neutral-900 ring-1 ring-white/10' : 'bg-white ring-1 ring-black/5'
                  }`}
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortBy(option.value)
                        setSortDropdownOpen(false)
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        sortBy === option.value
                          ? isDarkMode 
                            ? 'bg-white/10 text-white' 
                            : 'bg-sky-50 text-sky-600'
                          : isDarkMode
                            ? 'text-white/80 hover:bg-white/5'
                            : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-base">{option.icon}</span>
                      <span>{option.label}</span>
                      {sortBy === option.value && (
                        <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Distance/Time Overlay - Draggable */}
        <AnimatePresence>
          {routeInfo && selectedPlace && (
            <motion.div
              className={`absolute top-4 right-4 z-10 rounded-2xl shadow-2xl backdrop-blur-md cursor-grab active:cursor-grabbing ${
                isDarkMode ? 'bg-black/80 ring-1 ring-white/10' : 'bg-white/90 ring-1 ring-black/5'
              }`}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              drag
              dragMomentum={false}
              dragElastic={0.05}
              dragConstraints={mapContainerRef}
              whileDrag={{ scale: 1.02, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)' }}
            >
              {/* Drag handle indicator */}
              <div className={`flex justify-center pt-2 pb-1`}>
                <div className={`w-8 h-1 rounded-full ${isDarkMode ? 'bg-white/20' : 'bg-gray-300'}`} />
              </div>
              <div className="px-4 pb-4">
                <div className={`text-xs font-medium mb-2 truncate max-w-[200px] ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                  {selectedPlace.name}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-white/10' : 'bg-sky-100'}`}>
                      <svg className={`w-5 h-5 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{routeInfo.distance}</p>
                      <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Distance</p>
                    </div>
                  </div>
                  <div className={`w-px h-10 ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-white/10' : 'bg-green-100'}`}>
                      <svg className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{routeInfo.duration}</p>
                      <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Travel time</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Mobile Bottom Sheet Toggle Button */}
      <motion.button
        className={`lg:hidden fixed left-1/2 -translate-x-1/2 z-40 shadow-lg rounded-full px-6 py-3 flex items-center gap-2 text-sm font-medium ${
          isDarkMode ? 'bg-neutral-900 text-white' : 'bg-white text-gray-700'
        } ${
          triageResult.urgency === 'emergency' ? 'bottom-4' : 'bottom-4'
        } ${mobileSheetOpen ? 'hidden' : ''}`}
        onClick={() => { setMobileSheetOpen(true); setMobileSheetExpanded(false); }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        View {sortedPlaces.length} Hospitals
      </motion.button>

      {/* Mobile Bottom Sheet */}
      <AnimatePresence>
        {mobileSheetOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="lg:hidden fixed inset-0 bg-black/30 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSheetOpen(false)}
            />
            
            {/* Sheet */}
            <motion.div
              className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl shadow-2xl ${panelBgClass} ${
                mobileSheetExpanded ? 'max-h-[85vh]' : 'max-h-[50vh]'
              } overflow-hidden`}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) {
                  setMobileSheetOpen(false);
                } else if (info.offset.y < -50) {
                  setMobileSheetExpanded(true);
                }
              }}
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className={`w-10 h-1 rounded-full ${isDarkMode ? 'bg-white/20' : 'bg-gray-300'}`} />
              </div>

              {/* Sheet Header */}
              <div className={`flex items-center justify-between px-4 pb-3 border-b ${borderClass}`}>
                <div>
                  <h2 className={`text-base font-semibold ${panelTextClass}`}>Nearby Hospitals</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium text-white ${urgencyColors.bg}`}>
                      {triageResult.urgency?.toUpperCase()}
                    </span>
                    <span className={`text-xs truncate max-w-[150px] ${panelSubtextClass}`}>
                      {triageResult.department}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setMobileSheetOpen(false)}
                  className={`p-2 -mr-2 ${panelSubtextClass} hover:text-gray-600`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Sheet Content */}
              <div className="overflow-y-auto" style={{ maxHeight: mobileSheetExpanded ? 'calc(85vh - 100px)' : 'calc(50vh - 100px)' }}>
                {/* Loading */}
                {loading && (
                  <div className="flex flex-col items-center justify-center p-8">
                    <motion.div 
                      className="h-8 w-8 rounded-full border-3 border-sky-500 border-t-transparent"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <p className={`mt-3 text-sm ${panelSubtextClass}`}>Searching...</p>
                  </div>
                )}

                {/* Error */}
                {error && !loading && (
                  <div className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                {/* Mobile Results List */}
                {!loading && sortedPlaces.length > 0 && (
                  <div className="p-3 space-y-2">
                    {sortedPlaces.map((place, index) => (
                      <motion.div
                        key={place.place_id}
                        className={`rounded-xl ${cardBgClass} p-3 ring-1 cursor-pointer ${cardHoverClass} ${
                          selectedPlace?.place_id === place.place_id ? `ring-2 ${urgencyColors.ring}` : ringNeutral
                        }`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => {
                          setSelectedPlace(place);
                          mapInstanceRef.current?.panTo(place.geometry.location);
                          mapInstanceRef.current?.setZoom(15);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${urgencyColors.bg}`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className={`font-medium text-sm truncate ${panelTextClass}`}>{place.name}</h3>
                              {place.isOpen === true && (
                                <span className="flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">Open</span>
                              )}
                              {place.isOpen === false && (
                                <span className="flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">Closed</span>
                              )}}
                            </div>
                            <p className={`text-xs truncate mt-0.5 ${panelSubtextClass}`}>{place.vicinity || place.formatted_address}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs">
                              {place.rating && <span className="text-yellow-600">⭐ {place.rating.toFixed(1)}</span>}
                              <span className={panelSubtextClass}>📍 {place.distance.toFixed(1)} km</span>
                            </div>
                          </div>
                        </div>

                        {/* Dynamic button: Get Directions -> Start Navigation -> Stop Navigation */}
                        {selectedPlace?.place_id === place.place_id && routeInfo ? (
                          !isNavigating ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); startNavigation(); setMobileSheetOpen(false); }}
                              className="mt-3 w-full rounded-lg py-2 text-xs font-medium text-white bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg"
                            >
                              🚀 Start Navigation
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); stopNavigation(); }}
                              className="mt-3 w-full rounded-lg py-2 text-xs font-medium text-white bg-gradient-to-r from-red-500 to-rose-500 shadow-lg"
                            >
                              ⏹ Stop Navigation
                            </button>
                          )
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); showDirections(place); setMobileSheetOpen(false); }}
                            className={`mt-3 w-full rounded-lg py-2 text-xs font-medium text-white ${buttonBgClass}`}
                          >
                            Get Directions
                          </button>
                        )}

                        {/* Book Appointment Section - Mobile */}
                        <div className={`mt-3 pt-3 border-t ${borderClass}`}>
                          <p className={`text-xs font-medium mb-2 ${panelSubtextClass}`}>Book Appointment</p>
                          {(place.formatted_phone_number || place.website || place.url) ? (
                            <div className="flex flex-wrap gap-2">
                              {place.formatted_phone_number && (
                                <a
                                  href={`tel:${place.formatted_phone_number}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${isDarkMode ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700'}`}
                                >
                                  📞 Call
                                </a>
                              )}
                              {place.website && (
                                <a
                                  href={place.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${isDarkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-700'}`}
                                >
                                  🌐 Website
                                </a>
                              )}
                              {place.url && (
                                <a
                                  href={place.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${isDarkMode ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-700'}`}
                                >
                                  🧾 Google
                                </a>
                              )}
                            </div>
                          ) : (
                            <p className={`text-xs italic ${panelSubtextClass}`}>
                              Please contact the hospital reception for appointment.
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Mobile Route Info */}
                {routeInfo && (
                  <div className={`p-3 border-t ${borderClass}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={`text-sm font-medium ${panelTextClass}`}>Route to {selectedPlace?.name}</h3>
                      <button onClick={clearDirections} className={`text-xs ${panelSubtextClass}`}>Clear</button>
                    </div>

                    {/* Mobile Travel Mode Selector */}
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => {
                          setTravelMode('DRIVING')
                          if (!isNavigating && selectedPlace) showDirections(selectedPlace, null, 'DRIVING')
                        }}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium transition-all ${
                          travelMode === 'DRIVING'
                            ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                            : isDarkMode ? 'bg-neutral-800 text-white/70' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        🚗 Car
                      </button>
                      <button
                        onClick={() => {
                          setTravelMode('BICYCLING')
                          if (!isNavigating && selectedPlace) showDirections(selectedPlace, null, 'BICYCLING')
                        }}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium transition-all ${
                          travelMode === 'BICYCLING'
                            ? isDarkMode ? 'bg-green-600 text-white' : 'bg-green-500 text-white'
                            : isDarkMode ? 'bg-neutral-800 text-white/70' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        🚴 Bike
                      </button>
                      <button
                        onClick={() => {
                          setTravelMode('WALKING')
                          if (!isNavigating && selectedPlace) showDirections(selectedPlace, null, 'WALKING')
                        }}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium transition-all ${
                          travelMode === 'WALKING'
                            ? isDarkMode ? 'bg-orange-600 text-white' : 'bg-orange-500 text-white'
                            : isDarkMode ? 'bg-neutral-800 text-white/70' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        🚶 Walk
                      </button>
                    </div>

                    <div className="flex gap-3 mb-3">
                      <div className={`flex-1 rounded-lg px-3 py-2 text-center ${isDarkMode ? 'bg-neutral-800' : 'bg-sky-50'}`}>
                        <p className="text-base font-bold text-sky-600">{routeInfo.distance}</p>
                        <p className={`text-xs ${panelSubtextClass}`}>Distance</p>
                      </div>
                      <div className={`flex-1 rounded-lg px-3 py-2 text-center ${isDarkMode ? 'bg-neutral-800' : 'bg-green-50'}`}>
                        <p className="text-base font-bold text-green-600">{routeInfo.duration}</p>
                        <p className={`text-xs ${panelSubtextClass}`}>Duration</p>
                      </div>
                    </div>

                    {/* Mobile Start/Stop Navigation Button */}
                    {!isNavigating ? (
                      <button
                        onClick={() => { startNavigation(); setMobileSheetOpen(false); }}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Start Navigation
                      </button>
                    ) : (
                      <button
                        onClick={stopNavigation}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                        </svg>
                        Stop Navigation
                      </button>
                    )}

                    {/* Mobile Live Navigation Indicator */}
                    {isNavigating && (
                      <div className={`mt-3 p-2 rounded-xl flex items-center gap-2 ${isDarkMode ? 'bg-blue-900/30 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <p className={`text-xs font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                          Live • {travelMode === 'DRIVING' ? '🚗' : travelMode === 'BICYCLING' ? '🚴' : '🚶'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
