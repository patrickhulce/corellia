"""
This type stub file was generated by pyright.
"""

from typing import Optional
from browser_use.dom.history_tree_processor.view import DOMHistoryElement
from browser_use.dom.views import DOMElementNode

class HistoryTreeProcessor:
	""" "
	Operations on the DOM elements

	@dev be careful - text nodes can change even if elements stay the same
	"""
	@staticmethod
	def convert_dom_element_to_history_element(dom_element: DOMElementNode) -> DOMHistoryElement:
		...
	
	@staticmethod
	def find_history_element_in_tree(dom_history_element: DOMHistoryElement, tree: DOMElementNode) -> Optional[DOMElementNode]:
		...
	
	@staticmethod
	def compare_history_element_and_dom_element(dom_history_element: DOMHistoryElement, dom_element: DOMElementNode) -> bool:
		...
	


