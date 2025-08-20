import React, { useState, useEffect } from 'react';

// Logging Middleware
const Log = async (stack, level, package_name, message) => {
  const logData = {
    stack,
    level,
    package: package_name,
    message
  };

  try {
    const response = await fetch('http://20.244.56.144/evaluation-service/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'YOUR_BEARER_KEY'
      },
      body: JSON.stringify(logData)
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Logging failed:', error);
    return null;
  }
};

const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

const generateShortcode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const useUrlStorage = () => {
  const [urls, setUrls] = useState(() => {
    const stored = localStorage.getItem('shortUrls');
    if (stored) {
      return JSON.parse(stored).map(url => ({
        ...url,
        createdAt: new Date(url.createdAt),
        expiryDate: new Date(url.expiryDate)
      }));
    }
    return [];
  });

  const saveUrl = (urlData) => {
    Log('frontend', 'debug', 'hook', 'Attempting to save new URL');
    const newUrls = [...urls, urlData];
    setUrls(newUrls);
    localStorage.setItem('shortUrls', JSON.stringify(newUrls));
    Log('frontend', 'info', 'hook', `URL saved successfully with shortcode: ${urlData.shortcode}`);
  };

  const incrementClick = (shortcode, clickData) => {
    Log('frontend', 'debug', 'hook', `Incrementing click count for shortcode: ${shortcode}`);
    const updatedUrls = urls.map(url => {
      if (url.shortcode === shortcode) {
        const updatedUrl = {
          ...url,
          clicks: url.clicks + 1,
          clickHistory: [...url.clickHistory, clickData]
        };
        Log('frontend', 'info', 'hook', `Click recorded for ${shortcode}. Total clicks: ${updatedUrl.clicks}`);
        return updatedUrl;
      }
      return url;
    });
    setUrls(updatedUrls);
    localStorage.setItem('shortUrls', JSON.stringify(updatedUrls));
  };

  const getUrlByShortcode = (shortcode) => {
    return urls.find(url => url.shortcode === shortcode);
  };

  return { urls, saveUrl, incrementClick, getUrlByShortcode };
};

const useRouter = () => {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  return { currentPath, navigate };
};

const UrlShortener = ({ onNavigate }) => {
  const [urlInputs, setUrlInputs] = useState(Array(5).fill({ url: '', validity: '', customShortcode: '' }));
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { saveUrl, urls } = useUrlStorage();

  useEffect(() => {
    Log('frontend', 'info', 'page', 'URL Shortener page loaded');
  }, []);

  const handleInputChange = (index, field, value) => {
    Log('frontend', 'debug', 'component', `Input changed - Index: ${index}, Field: ${field}`);
    const newInputs = [...urlInputs];
    newInputs[index] = { ...newInputs[index], [field]: value };
    setUrlInputs(newInputs);
  };

  const validateInputs = (inputs) => {
    Log('frontend', 'debug', 'component', 'Starting input validation');
    const errors = [];
    
    inputs.forEach((input, index) => {
      if (input.url.trim()) {
        if (!isValidUrl(input.url)) {
          errors.push(`URL ${index + 1}: Invalid URL format`);
        }
        
        if (input.validity && (!Number.isInteger(Number(input.validity)) || Number(input.validity) <= 0)) {
          errors.push(`URL ${index + 1}: Validity must be a positive integer`);
        }
        
        if (input.customShortcode) {
          if (!/^[a-zA-Z0-9]+$/.test(input.customShortcode) || input.customShortcode.length > 10) {
            errors.push(`URL ${index + 1}: Custom shortcode must be alphanumeric and max 10 characters`);
          }
          
          const exists = urls.some(url => url.shortcode === input.customShortcode);
          if (exists) {
            errors.push(`URL ${index + 1}: Custom shortcode '${input.customShortcode}' already exists`);
          }
        }
      }
    });

    Log('frontend', errors.length > 0 ? 'warn' : 'info', 'component', `Validation completed. Errors found: ${errors.length}`);
    return errors;
  };

  const handleSubmit = async () => {
    Log('frontend', 'info', 'component', 'URL shortening process initiated');
    setLoading(true);
    
    const filledInputs = urlInputs.filter(input => input.url.trim());
    
    if (filledInputs.length === 0) {
      Log('frontend', 'warn', 'component', 'No URLs provided for shortening');
      alert('Please enter at least one URL');
      setLoading(false);
      return;
    }

    const errors = validateInputs(filledInputs);
    if (errors.length > 0) {
      Log('frontend', 'error', 'component', `Validation failed: ${errors.join('; ')}`);
      alert(errors.join('\n'));
      setLoading(false);
      return;
    }

    const newResults = [];
    const usedShortcodes = new Set(urls.map(url => url.shortcode));

    for (const input of filledInputs) {
      try {
        let shortcode = input.customShortcode;
        
        if (!shortcode) {
          do {
            shortcode = generateShortcode();
          } while (usedShortcodes.has(shortcode));
        }
        
        usedShortcodes.add(shortcode);
        
        const validityMinutes = input.validity ? parseInt(input.validity) : 30;
        const expiryDate = new Date(Date.now() + validityMinutes * 60000);
        
        const urlData = {
          id: Date.now() + Math.random(),
          originalUrl: input.url,
          shortcode: shortcode,
          shortUrl: `http://localhost:3000/${shortcode}`,
          createdAt: new Date(),
          expiryDate: expiryDate,
          clicks: 0,
          clickHistory: []
        };
        
        saveUrl(urlData);
        newResults.push(urlData);
        
        Log('frontend', 'info', 'component', `URL shortened successfully: ${input.url} -> ${shortcode}`);
      } catch (error) {
        Log('frontend', 'error', 'component', `Failed to shorten URL: ${input.url}, Error: ${error.message}`);
      }
    }

    setResults(newResults);
    setUrlInputs(Array(5).fill({ url: '', validity: '', customShortcode: '' }));
    setLoading(false);
    
    Log('frontend', 'info', 'component', `URL shortening completed. ${newResults.length} URLs processed`);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: '#1976d2', textAlign: 'center', marginBottom: '30px' }}>URL Shortener</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#333', marginBottom: '15px' }}>Shorten up to 5 URLs</h3>
        
        {urlInputs.map((input, index) => (
          <div key={index} style={{ 
            border: '1px solid #ddd', 
            borderRadius: '8px', 
            padding: '15px', 
            marginBottom: '15px',
            backgroundColor: '#f9f9f9'
          }}>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontWeight: 'bold', color: '#555' }}>URL {index + 1}:</label>
              <input
                type="url"
                placeholder="Enter URL to shorten"
                value={input.url}
                onChange={(e) => handleInputChange(index, 'url', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px',
                  marginTop: '5px'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 'bold', color: '#555' }}>Validity (minutes):</label>
                <input
                  type="number"
                  placeholder="30 (default)"
                  value={input.validity}
                  onChange={(e) => handleInputChange(index, 'validity', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                    marginTop: '5px'
                  }}
                />
              </div>
              
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 'bold', color: '#555' }}>Custom Shortcode (optional):</label>
                <input
                  type="text"
                  placeholder="e.g., mylink"
                  value={input.customShortcode}
                  onChange={(e) => handleInputChange(index, 'customShortcode', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                    marginTop: '5px'
                  }}
                />
              </div>
            </div>
          </div>
        ))}
        
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            backgroundColor: '#1976d2',
            color: 'white',
            padding: '12px 30px',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            width: '100%'
          }}
        >
          {loading ? 'Shortening URLs...' : 'Shorten URLs'}
        </button>
      </div>

      {results.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <h3 style={{ color: '#333', marginBottom: '15px' }}>Results</h3>
          {results.map((result, index) => (
            <div key={index} style={{ 
              border: '1px solid #4caf50', 
              borderRadius: '8px', 
              padding: '15px', 
              marginBottom: '15px',
              backgroundColor: '#f1f8e9'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Original URL:</strong> 
                <a href={result.originalUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', marginLeft: '8px' }}>
                  {result.originalUrl.length > 50 ? result.originalUrl.substring(0, 50) + '...' : result.originalUrl}
                </a>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Short URL:</strong> 
                <button onClick={() => onNavigate(`/${result.shortcode}`)} style={{ color: '#d32f2f', marginLeft: '8px', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  {result.shortUrl}
                </button>
              </div>
              <div style={{ color: '#666', fontSize: '14px' }}>
                <strong>Expires:</strong> {result.expiryDate.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div style={{ textAlign: 'center', marginTop: '30px' }}>
        <button onClick={() => onNavigate('/stats')} style={{ color: '#1976d2', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', textDecoration: 'underline' }}>
          View Statistics →
        </button>
      </div>
    </div>
  );
};


const Statistics = ({ onNavigate }) => {
  const { urls } = useUrlStorage();

  useEffect(() => {
    Log('frontend', 'info', 'page', 'Statistics page loaded');
  }, []);

  const activeUrls = urls.filter(url => new Date(url.expiryDate) > new Date());
  const expiredUrls = urls.filter(url => new Date(url.expiryDate) <= new Date());

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ color: '#1976d2', textAlign: 'center', marginBottom: '30px' }}>URL Statistics</h1>
      
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <button onClick={() => onNavigate('/')} style={{ color: '#1976d2', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', textDecoration: 'underline' }}>
          ← Back to URL Shortener
        </button>
      </div>

      {urls.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#666', fontSize: '18px', marginTop: '50px' }}>
          No URLs have been shortened yet.
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#4caf50', marginBottom: '15px' }}>Active URLs ({activeUrls.length})</h3>
            {activeUrls.length === 0 ? (
              <p style={{ color: '#666' }}>No active URLs</p>
            ) : (
              activeUrls.map((url) => (
                <div key={url.id} style={{
                  border: '1px solid #4caf50',
                  borderRadius: '8px',
                  padding: '15px',
                  marginBottom: '15px',
                  backgroundColor: '#f1f8e9'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Short URL:</strong>
                        <button onClick={() => onNavigate(`/${url.shortcode}`)} style={{ color: '#d32f2f', marginLeft: '8px', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                          {url.shortUrl}
                        </button>
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Original URL:</strong>
                        <a href={url.originalUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', marginLeft: '8px' }}>
                          {url.originalUrl.length > 60 ? url.originalUrl.substring(0, 60) + '...' : url.originalUrl}
                        </a>
                      </div>
                    </div>
                    <div style={{ minWidth: '120px', textAlign: 'right' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
                        {url.clicks} clicks
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                    <strong>Created:</strong> {new Date(url.createdAt).toLocaleString()} | 
                    <strong> Expires:</strong> {new Date(url.expiryDate).toLocaleString()}
                  </div>

                  {url.clickHistory.length > 0 && (
                    <div style={{ marginTop: '15px' }}>
                      <strong style={{ color: '#333' }}>Click History:</strong>
                      <div style={{ maxHeight: '150px', overflowY: 'auto', marginTop: '8px' }}>
                        {url.clickHistory.map((click, index) => (
                          <div key={index} style={{
                            padding: '5px 10px',
                            backgroundColor: '#fff',
                            border: '1px solid #e0e0e0',
                            borderRadius: '4px',
                            margin: '2px 0',
                            fontSize: '12px'
                          }}>
                            <strong>{new Date(click.timestamp).toLocaleString()}</strong> - 
                            Source: {click.source} | Location: {click.location}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {expiredUrls.length > 0 && (
            <div>
              <h3 style={{ color: '#f44336', marginBottom: '15px' }}>Expired URLs ({expiredUrls.length})</h3>
              {expiredUrls.map((url) => (
                <div key={url.id} style={{
                  border: '1px solid #f44336',
                  borderRadius: '8px',
                  padding: '15px',
                  marginBottom: '15px',
                  backgroundColor: '#ffebee',
                  opacity: 0.7
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Short URL:</strong>
                        <span style={{ marginLeft: '8px', color: '#666', textDecoration: 'line-through' }}>
                          {url.shortUrl}
                        </span>
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Original URL:</strong>
                        <span style={{ marginLeft: '8px', color: '#666' }}>
                          {url.originalUrl.length > 60 ? url.originalUrl.substring(0, 60) + '...' : url.originalUrl}
                        </span>
                      </div>
                    </div>
                    <div style={{ minWidth: '120px', textAlign: 'right' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#666' }}>
                        {url.clicks} clicks
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    <strong>Created:</strong> {new Date(url.createdAt).toLocaleString()} | 
                    <strong> Expired:</strong> {new Date(url.expiryDate).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const RedirectHandler = ({ shortcode, onNavigate }) => {
  const { getUrlByShortcode, incrementClick } = useUrlStorage();

  useEffect(() => {
    Log('frontend', 'info', 'component', `Redirect attempt for shortcode: ${shortcode}`);
    
    const urlData = getUrlByShortcode(shortcode);
    
    if (!urlData) {
      Log('frontend', 'warn', 'component', `Shortcode not found: ${shortcode}`);
      alert('URL not found');
      onNavigate('/');
      return;
    }

    if (new Date(urlData.expiryDate) <= new Date()) {
      Log('frontend', 'warn', 'component', `Expired URL accessed: ${shortcode}`);
      alert('This URL has expired');
      onNavigate('/');
      return;
    }

    const clickData = {
      timestamp: new Date(),
      source: document.referrer || 'Direct',
      location: 'Unknown' 
    };
    
    incrementClick(shortcode, clickData);
    Log('frontend', 'info', 'component', `Redirecting ${shortcode} to ${urlData.originalUrl}`);
    
    window.location.href = urlData.originalUrl;
    
  }, [shortcode, getUrlByShortcode, incrementClick, onNavigate]);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>Redirecting...</h2>
      <p>If you are not redirected automatically, <button onClick={() => onNavigate('/')} style={{ color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>click here</button></p>
    </div>
  );
};

const App = () => {
  const { currentPath, navigate } = useRouter();

  useEffect(() => {
    Log('frontend', 'info', 'component', 'URL Shortener application initialized');
  }, []);

  const handleNavigate = (path) => {
    navigate(path);
  };

  // Route matching
  if (currentPath === '/stats') {
    return <Statistics onNavigate={handleNavigate} />;
  } else if (currentPath !== '/' && currentPath.length > 1) {
    const shortcode = currentPath.substring(1);
    return <RedirectHandler shortcode={shortcode} onNavigate={handleNavigate} />;
  } else {
    return <UrlShortener onNavigate={handleNavigate} />;
  }
};

export default App;
