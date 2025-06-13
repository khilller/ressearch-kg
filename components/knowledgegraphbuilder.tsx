'use client'

import React, { useState } from 'react'
import { Upload, X, Zap, FileText, Settings, Play } from 'lucide-react'
import { getSuggestionsAction } from '@/lib/actions/actions'
import type { GraphData, ProcessingProgress } from '@/lib/types/types'
import InteractiveGraph from './InteractiveGraph'

export function KnowledgeGraphBuilder() {
  // File and configuration state
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [researchFocus, setResearchFocus] = useState("")
  
  // Entity and relationship state
  const [selectedEntities, setSelectedEntities] = useState(new Set<string>())
  const [selectedRelationships, setSelectedRelationships] = useState(new Set<string>())
  const [customEntity, setCustomEntity] = useState('')
  const [customRelationship, setCustomRelationship] = useState('')
  
  // AI suggestions state - starts empty
  const [aiSuggestedEntities, setAiSuggestedEntities] = useState<string[]>([])
  const [aiSuggestedRelationships, setAiSuggestedRelationships] = useState<string[]>([])
  const [aiReasoning, setAiReasoning] = useState('')
  
  // Loading and processing state
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      const newFiles = Array.from(files)
      setUploadedFiles(prev => [...prev, ...newFiles])
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles(files => files.filter((_, i) => i !== index))
  }

  const toggleEntity = (entity: string) => {
    setSelectedEntities(prev => {
      const newSet = new Set(prev)
      if (newSet.has(entity)) {
        newSet.delete(entity)
      } else {
        newSet.add(entity)
      }
      return newSet
    })
  }

  const toggleRelationship = (relationship: string) => {
    setSelectedRelationships(prev => {
      const newSet = new Set(prev)
      if (newSet.has(relationship)) {
        newSet.delete(relationship)
      } else {
        newSet.add(relationship)
      }
      return newSet
    })
  }

  const addCustomEntity = () => {
    if (customEntity.trim()) {
      setSelectedEntities(prev => new Set([...prev, customEntity.trim()]))
      setCustomEntity('')
    }
  }

  const addCustomRelationship = () => {
    if (customRelationship.trim()) {
      setSelectedRelationships(prev => new Set([...prev, customRelationship.trim().toUpperCase()]))
      setCustomRelationship('')
    }
  }

  const clearAllSelections = () => {
    setSelectedEntities(new Set<string>())
    setSelectedRelationships(new Set<string>())
  }

  const handleGetSuggestions = async () => {
    if (!researchFocus.trim()) {
      setError('Please describe your research focus first')
      return
    }

    setIsLoadingSuggestions(true)
    setError(null)

    try {
      // Only pass the research focus, no need for files
      const suggestions = await getSuggestionsAction(researchFocus, new FormData())
      
      // Set AI suggestions (don't auto-select them)
      setAiSuggestedEntities(suggestions.entities)
      setAiSuggestedRelationships(suggestions.relationships)
      setAiReasoning(suggestions.reasoning)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get suggestions')
    } finally {
      setIsLoadingSuggestions(false)
    }
  }

  const handleProcessDocuments = async () => {
    if (uploadedFiles.length === 0) {
      setError('Please upload at least one document')
      return
    }

    if (selectedEntities.size === 0 || selectedRelationships.size === 0) {
      setError('Please select at least one entity type and one relationship type')
      return
    }

    setIsProcessing(true)
    setError(null)
    setProcessingProgress(null)
    setGraphData(null)

    try {
      const formData = new FormData()
      uploadedFiles.forEach(file => formData.append('files', file))

      // Base64 encode the arrays to ensure ASCII-safe headers
      const entitiesB64 = btoa(JSON.stringify(Array.from(selectedEntities)))
      const relationshipsB64 = btoa(JSON.stringify(Array.from(selectedRelationships)))

      // Use streaming version for large files
      const response = await fetch('/api/process-documents-stream', {
      method: 'POST',
      body: formData,
      headers: {
        'X-Selected-Entities-B64': entitiesB64,
        'X-Selected-Relationships-B64': relationshipsB64
      }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        
        // Process complete messages
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: ProcessingProgress = JSON.parse(line.slice(6))
              setProcessingProgress(data)

              if (data.status === 'complete' && data.data) {
                setGraphData(data.data)
              } else if (data.status === 'error') {
                setError(data.error || 'Processing failed')
              }
            } catch {
              console.warn('Failed to parse SSE data:', line)
            }
          }
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed')
      setProcessingProgress(null)
    } finally {
      setIsProcessing(false)
    }
  }

  // Static step indicator - informational only
  const StepIndicator = ({ step, label }: { step: number; label: string }) => (
    <div className="flex items-center">
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-gray-200 text-gray-600">
        {step}
      </div>
      <span className="ml-2 text-sm font-medium text-gray-500">{label}</span>
    </div>
  )

  const TagItem = ({ item, isSelected, onToggle, type, isAiSuggested = false }: {
    item: string
    isSelected: boolean
    onToggle: (item: string) => void
    type: 'entity' | 'relationship'
    isAiSuggested?: boolean
  }) => (
    <label className={`flex items-center space-x-2 rounded-lg px-3 py-1 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg border ${
      isSelected 
        ? type === 'entity' 
          ? 'bg-blue-50 border-blue-200 text-blue-800' 
          : 'bg-green-50 border-green-200 text-green-800'
        : isAiSuggested
          ? type === 'entity'
            ? 'bg-blue-25 border-blue-100 text-blue-600'
            : 'bg-green-25 border-green-100 text-green-600'
          : 'bg-gray-50 border-gray-200 text-gray-600'
    }`}>
      <input 
        type="checkbox" 
        checked={isSelected}
        onChange={() => onToggle(item)}
        className={type === 'entity' ? 'text-blue-600' : 'text-green-600'}
      />
      <span className="text-sm">{item}</span>
      {isAiSuggested && <span className="text-xs opacity-60">AI</span>}
    </label>
  )

  // Combine selected and AI suggested entities (remove duplicates)
  const allAvailableEntities = [...new Set([...Array.from(selectedEntities), ...aiSuggestedEntities])]
  const allAvailableRelationships = [...new Set([...Array.from(selectedRelationships), ...aiSuggestedRelationships])]

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Graph Builder</h1>
          <p className="text-gray-600 mt-1">Extract entities and relationships from your documents</p>
        </div>
      </div>

      {/* Static Progress Steps - Informational Only */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center space-x-4 mb-8">
          <StepIndicator step={1} label="Upload" />
          <div className="w-12 h-0.5 bg-gray-300"></div>
          <StepIndicator step={2} label="Define Research" />
          <div className="w-12 h-0.5 bg-gray-300"></div>
          <StepIndicator step={3} label="Process" />
          <div className="w-12 h-0.5 bg-gray-300"></div>
          <StepIndicator step={4} label="Explore" />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Processing Progress Display */}
        {isProcessing && processingProgress && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-blue-800">Processing Documents</h4>
              <span className="text-sm text-blue-600">{processingProgress.progress}%</span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-blue-200 rounded-full h-2 mb-3">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${processingProgress.progress}%` }}
              ></div>
            </div>
            
            {/* Progress Message */}
            <p className="text-blue-700 text-sm mb-2">{processingProgress.message}</p>
            
            {/* File Progress */}
            {processingProgress.currentFile && (
              <div className="text-xs text-blue-600">
                Processing: {processingProgress.currentFile} 
                {processingProgress.fileIndex && processingProgress.totalFiles && 
                  ` (${processingProgress.fileIndex}/${processingProgress.totalFiles})`
                }
              </div>
            )}
            
            {/* Processing Details */}
            {processingProgress.details && (
              <div className="mt-2 text-xs text-blue-600">
                {processingProgress.details.entities && (
                  <span>Entities found: {processingProgress.details.entities} • </span>
                )}
                {processingProgress.details.relationships && (
                  <span>Relationships: {processingProgress.details.relationships}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Configuration */}
          <div className="col-span-4 space-y-6">
            {/* Step 1: Uploaded Files */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center space-x-2 mb-4">
                <FileText className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Uploaded Documents</h3>
              </div>
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <span className="text-xs text-gray-500">({(file.size / 1024 / 1024).toFixed(1)}MB)</span>
                    </div>
                    <button 
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700"
                      disabled={isProcessing}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isProcessing}
                />
                <label
                  htmlFor="file-upload"
                  className={`block p-4 border-2 border-dashed border-gray-300 rounded-lg text-center transition-colors cursor-pointer ${
                    isProcessing 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    {isProcessing ? 'Processing...' : 'Drop PDF files here or '}
                    {!isProcessing && <span className="text-blue-600 hover:underline">browse</span>}
                  </p>
                </label>
              </div>
            </div>

            {/* Step 2: Research Definition */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Settings className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Research Focus</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">What are you researching?</label>
                  <textarea 
                    value={researchFocus}
                    onChange={(e) => setResearchFocus(e.target.value)}
                    className="w-full h-24 p-3 border border-gray-300 text-gray-900 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="E.g., 'I'm analyzing biotech patent relationships and company acquisitions to understand collaboration networks in drug development'"
                    disabled={isProcessing}
                  />
                </div>
                <button 
                  onClick={handleGetSuggestions}
                  disabled={isLoadingSuggestions || uploadedFiles.length === 0 || !researchFocus.trim() || isProcessing}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <Zap className="w-4 h-4" />
                  <span>{isLoadingSuggestions ? 'Getting Suggestions...' : 'Get AI Suggestions'}</span>
                </button>
                {aiSuggestedEntities.length === 0 && !isProcessing && (
                  <p className="text-xs text-gray-500">
                    💡 Tip: You can also add your own entities and relationships manually below
                  </p>
                )}
              </div>
            </div>

            {/* Step 3: Entity and Relationship Configuration */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {aiSuggestedEntities.length > 0 ? 'Configure Entities & Relationships' : 'Manual Configuration'}
                  </h3>
                </div>
                {(selectedEntities.size > 0 || selectedRelationships.size > 0) && !isProcessing && (
                  <button
                    onClick={clearAllSelections}
                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              {/* Show AI reasoning if available */}
              {aiReasoning && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>AI Analysis:</strong> {aiReasoning}
                  </p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Entity Types:</h4>
                  <div className="flex flex-wrap gap-2">
                    {allAvailableEntities.map(entity => (
                      <TagItem 
                        key={entity}
                        item={entity}
                        isSelected={selectedEntities.has(entity)}
                        onToggle={isProcessing ? () => {} : toggleEntity}
                        type="entity"
                        isAiSuggested={aiSuggestedEntities.includes(entity) && !selectedEntities.has(entity)}
                      />
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Relationship Types:</h4>
                  <div className="flex flex-wrap gap-2">
                    {allAvailableRelationships.map(relationship => (
                      <TagItem 
                        key={relationship}
                        item={relationship}
                        isSelected={selectedRelationships.has(relationship)}
                        onToggle={isProcessing ? () => {} : toggleRelationship}
                        type="relationship"
                        isAiSuggested={aiSuggestedRelationships.includes(relationship) && !selectedRelationships.has(relationship)}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex space-x-2 mb-2">
                    <input 
                      type="text" 
                      value={customEntity}
                      onChange={(e) => setCustomEntity(e.target.value)}
                      placeholder="Add custom entity type"
                      className="flex-1 px-3 py-1 border border-gray-300 rounded text-gray-500 text-sm focus:ring-1 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && !isProcessing && addCustomEntity()}
                      disabled={isProcessing}
                    />
                    <button 
                      onClick={addCustomEntity}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-blue-400"
                      disabled={isProcessing}
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      value={customRelationship}
                      onChange={(e) => setCustomRelationship(e.target.value)}
                      placeholder="Add custom relationship"
                      className="flex-1 px-3 py-1 border border-gray-300 text-gray-500 rounded text-sm focus:ring-1 focus:ring-green-500"
                      onKeyPress={(e) => e.key === 'Enter' && !isProcessing && addCustomRelationship()}
                      disabled={isProcessing}
                    />
                    <button 
                      onClick={addCustomRelationship}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:bg-green-400"
                      disabled={isProcessing}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Process Button */}
            <button 
              onClick={handleProcessDocuments}
              disabled={isProcessing || uploadedFiles.length === 0 || selectedEntities.size === 0 || selectedRelationships.size === 0}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-purple-400 disabled:to-blue-400 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg flex items-center justify-center space-x-2"
            >
              <Play className="w-5 h-5" />
              <span>
                {isProcessing 
                  ? `Processing... ${processingProgress?.progress || 0}%`
                  : 'Process Documents & Build Graph'
                }
              </span>
            </button>
          </div>

          {/* Right Side - Graph Preview/Results */}
          <div className="col-span-8">
            <div className="bg-white rounded-lg shadow-sm border h-full">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Knowledge Graph</h3>
                <p className="text-sm text-gray-600">
                  {graphData ? 'Processing complete! View your extracted knowledge graph below.' : 'Configure your settings and process documents to see the graph'}
                </p>
              </div>
              
              {/* Graph Content */}
              {graphData ? (
                <div className="p-4">
                    <InteractiveGraph data={graphData} />
                </div>
                ) : (
                <div className="h-96 flex items-center justify-center bg-gray-50 m-4 rounded-lg border-2 border-dashed border-gray-300">
                    <div className="text-center">
                    <div className="w-24 h-24 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                        <Zap className="w-12 h-12 text-gray-400" />
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Graph will appear here</h4>
                    <p className="text-gray-600 max-w-sm">After processing, you&apos;ll see your knowledge graph with:</p>
                    <ul className="text-sm text-gray-500 mt-2 space-y-1">
                        <li>• Extracted entities from your documents</li>
                        <li>• Relationships between concepts</li>
                        <li>• Interactive exploration capabilities</li>
                    </ul>
                    </div>
                </div>
                )}

              {/* Graph Controls */}
              <div className="p-4 border-t bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {graphData ? (
                      <>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span className="text-sm text-gray-600">
                            Entities ({graphData.nodes.length})
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-gray-600">
                            Relationships ({graphData.relationships.length})
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-sm text-gray-500">
                        Ready to process {uploadedFiles.length} document{uploadedFiles.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      className="px-3 py-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 disabled:text-gray-400 rounded text-sm transition-colors"
                      disabled={!graphData}
                    >
                      Export JSON
                    </button>
                    <button 
                      className="px-3 py-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 disabled:text-gray-400 rounded text-sm transition-colors"
                      disabled={!graphData}
                    >
                      Export CSV
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Configuration Summary */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border p-4">
          <h4 className="font-medium text-gray-900 mb-2">Current Configuration:</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Selected Entities ({selectedEntities.size}):</span>
              <div className="mt-1 text-gray-600">
                {Array.from(selectedEntities).join(', ') || 'None selected'}
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-700">Selected Relationships ({selectedRelationships.size}):</span>
              <div className="mt-1 text-gray-600">
                {Array.from(selectedRelationships).join(', ') || 'None selected'}
              </div>
            </div>
          </div>
          {aiSuggestedEntities.length > 0 && (
            <div className="mt-3 pt-3 border-t text-xs text-gray-500">
              💡 AI suggested {aiSuggestedEntities.length} entities and {aiSuggestedRelationships.length} relationships based on your research focus
            </div>
          )}
        </div>

        {/* Debug Information - Show extracted data */}
        {graphData && (
          <div className="mt-6 space-y-4">
            {/* Debug: Show all extracted nodes */}
            <details className="bg-white rounded-lg shadow-sm border">
              <summary className="p-4 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
                🔍 Debug: View All Extracted Entities ({graphData.nodes.length})
              </summary>
              <div className="p-4 pt-0 space-y-2 max-h-60 overflow-y-auto">
                {graphData.nodes.map((node, index) => (
                  <div key={index} className="text-xs p-3 bg-gray-50 rounded border">
                    <div className="flex items-center justify-between mb-1">
                      <strong className="text-blue-700">{node.id}</strong>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        {node.type}
                      </span>
                    </div>
                    {(() => {
                      const description = node.properties.description;
                      return typeof description === 'string' && description ? (
                        <div className="text-gray-600 text-xs">
                          {description}
                        </div>
                      ) : null;
                    })()}
                  </div>
                ))}
              </div>
            </details>

            {/* Debug: Show all extracted relationships */}
            <details className="bg-white rounded-lg shadow-sm border">
              <summary className="p-4 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
                🔗 Debug: View All Extracted Relationships ({graphData.relationships.length})
              </summary>
              <div className="p-4 pt-0 space-y-2 max-h-60 overflow-y-auto">
                {graphData.relationships.map((rel, index) => (
                  <div key={index} className="text-xs p-3 bg-gray-50 rounded border">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <strong className="text-gray-800">{rel.source}</strong>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                          {rel.type}
                        </span>
                        <strong className="text-gray-800">{rel.target}</strong>
                      </div>
                    </div>
                    {(() => {
                      const description = rel.properties.description;
                      return description ? (
                        <div className="text-gray-600 text-xs">
                          {String(description)}
                        </div>
                      ) : null;
                    })()}
                  </div>
                ))}
              </div>
            </details>

            {/* Debug: Show graph statistics */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h4 className="font-medium text-gray-900 mb-3">📊 Graph Statistics</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center p-3 bg-blue-50 rounded">
                  <div className="text-2xl font-bold text-blue-600">{graphData.nodes.length}</div>
                  <div className="text-blue-700">Total Entities</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded">
                  <div className="text-2xl font-bold text-green-600">{graphData.relationships.length}</div>
                  <div className="text-green-700">Total Relationships</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded">
                  <div className="text-2xl font-bold text-purple-600">
                    {[...new Set(graphData.nodes.map(n => n.type))].length}
                  </div>
                  <div className="text-purple-700">Entity Types</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded">
                  <div className="text-2xl font-bold text-amber-600">
                    {[...new Set(graphData.relationships.map(r => r.type))].length}
                  </div>
                  <div className="text-amber-700">Relationship Types</div>
                </div>
              </div>
              
              {/* Entity types breakdown */}
              <div className="mt-4 pt-4 border-t">
                <h5 className="font-medium text-gray-800 mb-2">Entity Types Found:</h5>
                <div className="flex flex-wrap gap-2">
                  {[...new Set(graphData.nodes.map(n => n.type))].map(type => {
                    const count = graphData.nodes.filter(n => n.type === type).length
                    return (
                      <span key={type} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {type} ({count})
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* Relationship types breakdown */}
              <div className="mt-3">
                <h5 className="font-medium text-gray-800 mb-2">Relationship Types Found:</h5>
                <div className="flex flex-wrap gap-2">
                  {[...new Set(graphData.relationships.map(r => r.type))].map(type => {
                    const count = graphData.relationships.filter(r => r.type === type).length
                    return (
                      <span key={type} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                        {type} ({count})
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}