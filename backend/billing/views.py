from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.utils import timezone
from django.db.models import Q
from decimal import Decimal
from .models import Client, Invoice
from .serializers import ClientSerializer, InvoiceSerializer, InvoiceCreateSerializer
from .services import create_invoice_with_lines
from .permissions import IsOwner


class InvoicePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 50


@api_view(['GET'])
def current_user(request):
    return Response({
        "id": request.user.id,
        "email": request.user.email,
        "role": request.user.role,
    })

# --- CLIENT ENDPOINTS ---
@api_view(['GET', 'POST'])
@permission_classes([IsOwner])
def client_list(request):
    if request.method == 'GET':
        clients = Client.objects.all().order_by('-created_at')
        serializer = ClientSerializer(clients, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = ClientSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# --- INVOICE ENDPOINTS ---
@api_view(['GET', 'POST'])
@permission_classes([IsOwner])
def invoice_list(request):
    if request.method == 'GET':
        invoices = Invoice.objects.all().order_by('-invoice_no')
        invoice_status = request.query_params.get('status')
        search = request.query_params.get('search', '').strip()
        if invoice_status in dict(Invoice.STATUS_CHOICES):
            invoices = invoices.filter(status=invoice_status)
        if search:
            search_query = Q(client__name__icontains=search) | Q(client__email__icontains=search)
            if search.isdigit():
                search_query |= Q(invoice_no=int(search))
            invoices = invoices.filter(search_query)
        paginator = InvoicePagination()
        page = paginator.paginate_queryset(invoices, request)
        serializer = InvoiceSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
    
    elif request.method == 'POST':
        serializer = InvoiceCreateSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            try:
                # Call our safe service function that locks the sequence!
                invoice = create_invoice_with_lines(
                    client_id=data['client_id'],
                    status=data['status'],
                    lines_data=data['lines']
                )
                return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsOwner])
def invoice_detail(request, pk):
    try:
        invoice = Invoice.objects.get(pk=pk)
    except Invoice.DoesNotExist:
        return Response({"error": "Invoice not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(InvoiceSerializer(invoice).data)
    
    elif request.method == 'PATCH':
        # We only allow updating the status (e.g., marking as paid)
        new_status = request.data.get('status')
        if new_status in ['draft', 'unpaid', 'paid', 'void']:
            invoice.status = new_status
            invoice.save()
            return Response(InvoiceSerializer(invoice).data)
        return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)
        
    elif request.method == 'DELETE':
        invoice.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsOwner])
def unpaid_invoice_aging(request):
    now = timezone.now()
    buckets = {
        'current': {'label': '0–30 days', 'count': 0, 'total': Decimal('0.00')},
        'days_31_60': {'label': '31–60 days', 'count': 0, 'total': Decimal('0.00')},
        'days_61_90': {'label': '61–90 days', 'count': 0, 'total': Decimal('0.00')},
        'over_90': {'label': '90+ days', 'count': 0, 'total': Decimal('0.00')},
    }

    invoices = Invoice.objects.filter(status='unpaid').only('total', 'created_at')
    for invoice in invoices:
        age = (now - invoice.created_at).days
        if age <= 30:
            key = 'current'
        elif age <= 60:
            key = 'days_31_60'
        elif age <= 90:
            key = 'days_61_90'
        else:
            key = 'over_90'
        buckets[key]['count'] += 1
        buckets[key]['total'] += invoice.total

    total_outstanding = sum((bucket['total'] for bucket in buckets.values()), Decimal('0.00'))
    return Response({
        'total_outstanding': str(total_outstanding),
        'invoice_count': sum(bucket['count'] for bucket in buckets.values()),
        'buckets': [
            {**bucket, 'key': key, 'total': str(bucket['total'])}
            for key, bucket in buckets.items()
        ],
    })


@api_view(['GET'])
@permission_classes([IsOwner])
def invoice_summary(request):
    summary = {
        'total_invoices': 0,
        'total_billed': Decimal('0.00'),
        'paid_total': Decimal('0.00'),
        'outstanding_total': Decimal('0.00'),
        'draft_count': 0,
    }
    for invoice in Invoice.objects.only('status', 'total'):
        summary['total_invoices'] += 1
        if invoice.status != 'void':
            summary['total_billed'] += invoice.total
        if invoice.status == 'paid':
            summary['paid_total'] += invoice.total
        elif invoice.status == 'unpaid':
            summary['outstanding_total'] += invoice.total
        elif invoice.status == 'draft':
            summary['draft_count'] += 1

    return Response({key: str(value) if isinstance(value, Decimal) else value for key, value in summary.items()})
