require 'csv'
require 'json'

module Decommunisation
  class Document
    def initialize
      @path = 'document.csv'
      @read_mode = 'r:bom|utf-8'
      @tables = []
    end

    def read_tables
      expected_labels = [
        'districts',
        'streets',
        'parks',
        'metro stations'
      ]

      current_label = nil

      CSV.foreach(@path, @read_mode) do |line|
        if line[0] && line[0].to_i == 1
          current_label = expected_labels.shift
          @tables << Table.new(current_label)
        end

        row = case current_label
              when 'districts' then District.new(line)
              when 'streets' then Street.new(line)
              when 'parks' then Park.new(line)
              when 'metro stations' then MetroStation.new(line)
              else District.new(line)
              end
        next if row.empty?

        if row.only_description?
          @tables.last.last_row.last_cell.concat(row.last_cell)
          next
        elsif row.no_description?
          if @tables.last.last_row
            row.description = @tables.last.last_row.description
          end
        end

        @tables.last.add_row(row)
      end

      @tables
    end
  end

  class Table
    attr_reader :rows
    attr_reader :label

    def initialize(label)
      @label = label
      @rows = []
    end

    def add_row(row)
      @rows << row
    end

    def last_row
      @rows.last
    end

    def as_json
      data = @rows.map do |row|
        h = row.to_h
        h.keys.each do |k|
          h[k] && h[k].gsub!("\n", ' ')
        end
        h
      end

      JSON.generate(data)
    end
  end

  class Row
    attr_reader :row
    attr_accessor :description

    def initialize(row)
      @row = row
    end

    def id
      @row[0].to_i
    end

    def empty?
      all_empty_cells?(@row)
    end

    def only_description?
      all_empty_cells?(@row[0..-2]) && !last_cell.empty?
    end

    def no_description?
      !all_empty_cells?(@row[0..-2]) && last_cell.empty?
    end

    def last_cell
      @row[-1].to_s
    end

    protected

    def all_empty_cells?(cells)
      cells.compact.reject(&:empty?).empty?
    end
  end

  class District < Row
    def to_h
      {
        ukr_name: ukr_name,
        description: description
      }
    end

    def description
      super || @row[3]
    end

    private

    def ukr_name
      @row[1]
    end

    def rus_name
      @row[2]
    end
  end

  class Street < Row
    def to_h
      {
        ukr_name: ukr_name,
        ukr_type: ukr_type,
        district: district,
        postcode: postcode,
        description: description
      }
    end

    def description
      super || @row[7]
    end

    private

    def ukr_name
      @row[1]
    end

    def ukr_type
      @row[2]
    end

    def rus_name
      @row[3]
    end

    def rus_type
      @row[4]
    end

    def district
      @row[5]
    end

    def postcode
      @row[6]
    end
  end

  class Park < Row
    def to_h
      {
        ukr_name: ukr_name,
        ukr_type: ukr_type,
        district: district,
        description: description
      }
    end

    def description
      super || @row[6]
    end

    private

    def ukr_name
      @row[1]
    end

    def ukr_type
      @row[2]
    end

    def rus_name
      @row[3]
    end

    def rus_type
      @row[4]
    end

    def district
      @row[5]
    end
  end

  class MetroStation < Row
    def to_h
      {
        ukr_name: ukr_name,
        description: description
      }
    end

    def description
      super || @row[3]
    end

    private

    def ukr_name
      @row[1]
    end

    def rus_name
      @row[2]
    end
  end
end

Decommunisation::Document.new.read_tables.each do |table|
  File.open(table.label + '.json', 'w') do |f|
    f.write(table.as_json)
  end
end
