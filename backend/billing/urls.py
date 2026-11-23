from django.urls import path
from . import views

urlpatterns = [
    path('auth/me/', views.current_user, name='current-user'),
    path('clients/', views.client_list, name='client-list'),
    path('invoices/', views.invoice_list, name='invoice-list'),
    path('invoices/<int:pk>/', views.invoice_detail, name='invoice-detail'),
    path('analytics/unpaid-by-age/', views.unpaid_invoice_aging, name='unpaid-invoice-aging'),
    path('analytics/summary/', views.invoice_summary, name='invoice-summary'),
]
