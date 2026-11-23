from rest_framework import serializers
from .models import Client, Invoice, InvoiceLine

class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'

class InvoiceLineSerializer(serializers.ModelSerializer):
    qty = serializers.IntegerField(min_value=1)
    price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)

    class Meta:
        model = InvoiceLine
        fields = ['item', 'qty', 'price']

class InvoiceSerializer(serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True, read_only=True)
    client_name = serializers.ReadOnlyField(source='client.name')

    class Meta:
        model = Invoice
        fields = ['id', 'client', 'client_name', 'invoice_no', 'total', 'status', 'created_at', 'lines']

class InvoiceCreateSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    status = serializers.ChoiceField(choices=Invoice.STATUS_CHOICES, default='draft')
    lines = InvoiceLineSerializer(many=True)

    def validate_lines(self, value):
        if not value:
            raise serializers.ValidationError("An invoice must have at least one line.")
        return value
