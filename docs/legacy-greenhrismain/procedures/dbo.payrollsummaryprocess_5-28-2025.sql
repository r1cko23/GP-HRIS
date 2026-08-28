-- =============================================
-- Author:		<Pat Relos>
-- Create date: <5-5-2023>
-- Description:	<Include Other Dedution and Adjustment in Payroll Summary>
-- =============================================
create PROCEDURE [dbo].[payrollsummaryprocess 5-28-2025]
	 @idclient INT,
	 @iddepartment Int, 
	 @uname NVARCHAR(20),
	 @datestart date,
	 @guid nvarchar(100)
	 		
AS	
BEGIN

DECLARE 
	@count int
	
	--' DECLARE @sqldelpayrollsummary2 NVARCHAR(MAX)

   -- 'SET @sqldelpayrollsummary2 = N'DELETE FROM payroll_summary2 WHERE idclientp = ' + @idclient + N' AND uname = @uname'

   -- 'EXEC (@sqldelpayrollsummary2)


DELETE FROM payroll_summary2 WHERE idclientp = @idclient AND uname = @uname

--'Employee Name
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
   SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, Date_Start, Date_End, payrolldate, payrollpaytype, 0 AS Headersort, 'Employee Name' AS Headername,  @uname  AS uname,@guid
   FROM payroll_summary
   WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment

   
  --'append daily rate
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,dailyrate_payroll, Date_Start, Date_End, payrolldate, payrollpaytype, 1 AS Headersort, 'Daily Rate' AS Headername, @uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment

	      --'append hours
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,noofhourswork, Date_Start, Date_End, payrolldate, payrollpaytype, 3 AS Headersort, 'Hours' AS Headername, @uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment

  --'append days
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, noofdayswork, Date_Start, Date_End, payrolldate, payrollpaytype, 4 AS Headersort, 'Days' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment

	   
	--'append basic	   
   INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, basic, Date_Start, Date_End, payrolldate, payrollpaytype, 5 AS Headersort, 'Basic' AS Headername, @uname  AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment

		

 --'append total salary
 	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(totalsalary AS DECIMAL(10,2)) as totalsalary, Date_Start, Date_End, payrolldate, payrollpaytype, 7 AS Headersort, 'Total Salary' AS Headername, @uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append regular overtime hours
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, overtime_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 8 AS Headersort, 'Reg OT Hours' AS Headername, @uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append regular overtime amount
  INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(overtime AS DECIMAL(10,2)) AS overtime, Date_Start, Date_End, payrolldate, payrollpaytype, 9 AS Headersort, 'Reg OT Amt' AS Headername, @uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append OT night diff hours 

    INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,nightdiff_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 10 AS Headersort,  'NightDiff Hours' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append OT night diff amount
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(nightdiff AS DECIMAL(10,2)) AS nightdiff, Date_Start, Date_End, payrolldate, payrollpaytype, 11 AS Headersort, 'NightDiff Amt' AS Headername,@uname  AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Regular night diff OT hours 
   INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,regularnightshiftOT_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 30 AS Headersort, 'Reg Nightdiff OT Hours' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment



	--'append Regular night diff amount 

   INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(regularnightshiftOT AS DECIMAL(10,2))  AS regularnightshiftOT , Date_Start, Date_End, payrolldate, payrollpaytype, 30.1 AS Headersort, 'Reg Nightdiff OT Amt' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Legal No Work Hours
	--INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    --SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,legalnoworkhours, Date_Start, Date_End, payrolldate, payrollpaytype, 11.3 AS Headersort, 'Legal No Work Hours' AS Headername,@uname AS uname
    --FROM payroll_summary
    --WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Legal No Work amount
	--INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    --SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,legalnowork, Date_Start, Date_End, payrolldate, payrollpaytype, 11.4 AS Headersort,'Legal No Work Amt' AS Headername,@uname AS uname
    --FROM payroll_summary
    --WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Legal holiday hours
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,legalholiday_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 12 AS Headersort, 'Legal Holiday Hours' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Legal holiday amt
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,legalholiday, Date_Start, Date_End, payrolldate, payrollpaytype, 13 AS Headersort, 'Legal Holiday Amt' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment

	--'append Legal holiday hours2
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,legalholiday2_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 13.1 AS Headersort, 'Legal Holiday2 Hours' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Legal holiday amt2
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,legalholiday2, Date_Start, Date_End, payrolldate, payrollpaytype, 13.2 AS Headersort, 'Legal Holiday2 Amt' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment






	--'append Legal holiday OT HOURS
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,legalholidayOT_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 14 AS Headersort, 'Legal Holiday OT Hours' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment

	
	--'append Legal holiday OT amt	
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(legalholidayOT AS DECIMAL(10,2)) AS legalholidayOT, Date_Start, Date_End, payrolldate, payrollpaytype, 15 AS Headersort, 'Legal Holiday OT Amt' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Legal holiday nightdiff hours
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,legalholidayND_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 16 AS Headersort, 'Legal Holiday ND Hours' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Legal holiday nightdiff amount
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(legalholidayND AS DECIMAL(10,2)) AS legalholidayND, Date_Start, Date_End, payrolldate, payrollpaytype, 17 AS Headersort, 'Legal Holiday ND Amt' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Legal holiday OTND hours	
	--INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    --SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,lhotndh, Date_Start, Date_End, payrolldate, payrollpaytype, 17.1 AS Headersort, 'LH OT ND Hours' AS Headername,@uname AS uname
    --FROM payroll_summary
    --WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Legal holiday OTND amount
	--INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    --SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(lhotnd AS DECIMAL(10,2)) AS lhotnd, Date_Start, Date_End, payrolldate, payrollpaytype, 17.2 AS Headersort, 'LH OT ND Amt' AS Headername,@uname AS uname
    --FROM payroll_summary
    --WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append special holiday hours
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,holiday_special_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 18 AS Headersort, 'Special Holiday Hours' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append special holiday amount
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(holiday_special AS DECIMAL(10,2)) AS holiday_special, Date_Start, Date_End, payrolldate, payrollpaytype, 19 AS Headersort, 'Special Holiday Amt' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


		---

	--'append special holiday2 hours
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,specialholiday2_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 19.1 AS Headersort, 'Special Holiday2 Hours' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append special holiday2 amount
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(specialholiday2 AS DECIMAL(10,2)) AS holiday_special2, Date_Start, Date_End, payrolldate, payrollpaytype, 19.2 AS Headersort, 'Special Holiday2 Amt' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment




	--'append special holiday OT Hours
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,holiday_specialOT_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 20 AS Headersort, 'Special Holiday OT Hours' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append special holiday OT Amount
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(holiday_specialOT AS DECIMAL(10,2)) AS holiday_specialOT , Date_Start, Date_End, payrolldate, payrollpaytype, 21 AS Headersort, 'Special Holiday OT Amt' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append special holiday ND hours
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,SHnightdiffOT_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 22 AS Headersort, 'Special Holiday ND Hours' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append special holiday ND amount
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(Holiday_Specialnightdiff AS DECIMAL(10,2)) AS holiday_specialnightdiff, Date_Start, Date_End, payrolldate, payrollpaytype, 23 AS Headersort, 'Special Holiday ND Amt' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append special holiday OTND hours
	--INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    --SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,shotndh, Date_Start, Date_End, payrolldate, payrollpaytype, 23.1 AS Headersort, 'SH OT ND Hours' AS Headername,@uname AS uname
    --FROM payroll_summary
    --WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment



	--'append special holiday OTND amount
	--INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    --SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(shotnd AS DECIMAL(10,2)) AS shotnd, Date_Start, Date_End, payrolldate, payrollpaytype, 23.2 AS Headersort, 'SH OT ND Amt' AS Headername,@uname AS uname
    --FROM payroll_summary
    --WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append special holiday RDOT Hours
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,SHONRDOThours, Date_Start, Date_End, payrolldate, payrollpaytype, 24 AS Headersort, 'SH Restday OT Hours' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append special holiday RDOT amount
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(SHONRDOT AS DECIMAL(10,2)) AS SHONRDOT, Date_Start, Date_End, payrolldate, payrollpaytype, 25 AS Headersort, 'SH Restday OT Amt' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment



	--'append legal holiday RDOT Hours
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,LHONRDOThours, Date_Start, Date_End, payrolldate, payrollpaytype, 25.1 AS Headersort, 'LH Restday OT Hours' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append legal holiday RDOT amount
	DECLARE @legalholidayRDOTamount  NVARCHAR(MAX)
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(LHONRDOT AS DECIMAL(10,2)) AS LHONRDOT, Date_Start, Date_End, payrolldate, payrollpaytype, 25.2 AS Headersort, 'LH Restday OT Amt' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append RD Hours
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,rdhours, Date_Start, Date_End, payrolldate, payrollpaytype, 26 AS Headersort, 'Restday Hours' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append RD amount

	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,RD, Date_Start, Date_End, payrolldate, payrollpaytype, 26.1 AS Headersort, 'Restday Amt' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment



	--'append RDOT Hours
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,rdothours, Date_Start, Date_End, payrolldate, payrollpaytype, 26.2 AS Headersort, 'Restday OT Hours' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append RDOT amount

	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,RDot, Date_Start, Date_End, payrolldate, payrollpaytype, 26.3 AS Headersort, 'Restday OT Amt' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment

	

	--'append RDND Hours
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,rdndhours, Date_Start, Date_End, payrolldate, payrollpaytype, 26.4 AS Headersort, 'Restday ND Hours' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append RDND amount

	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,rdnd, Date_Start, Date_End, payrolldate, payrollpaytype, 26.5 AS Headersort, 'Restday ND Amt' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment

	
	   
	   

	--'append WDO Hours
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,wdohours, Date_Start, Date_End, payrolldate, payrollpaytype, 28 AS Headersort, 'Working Dayoff Hours' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append WDO amount
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,wdo, Date_Start, Date_End, payrolldate, payrollpaytype, 29 AS Headersort, 'Working Dayoff Amt' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Total OT
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,totalOT, Date_Start, Date_End, payrolldate, payrollpaytype, 40 AS Headersort, 'Total OT' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


   --'append Total ND
	--INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
   -- SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,nightdifftotal, Date_Start, Date_End, payrolldate, payrollpaytype, 40.1 AS Headersort, 'Total Night Diff' AS Headername,@uname AS uname
    --FROM payroll_summary
    --WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Gross Salary assign value 200
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(grossalary AS DECIMAL(10,2)) as grossalary, Date_Start, Date_End, payrolldate, payrollpaytype, 200 AS Headersort, 'Gross Amt' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment



	--'append SSS plus Employer mandatory
	INSERT INTO payroll_summary2
    (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, Amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname, contributionSSSER, 
	contributionphilhealthER, contributionPagibigER, contributionSSSECC,guid)
	SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(contributionSSSEE AS DECIMAL(10, 2)) AS contributionsssee, Date_Start, Date_End, payrolldate, payrollpaytype, 
    201 AS Headersort, 'SSS' AS Headername, @uname AS uname, contributionSSSER, contributionphilhealthER, contributionPagibigER, contributionSSSECC,@guid
	FROM payroll_summary
	WHERE(idclientp = @idclient) AND (Date_Start = @datestart) AND (department_codep = @iddepartment)

	--'append SSS PRo
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(contributionSSSEEpro AS DECIMAL(10,2)) as contributionssseepro, Date_Start, Date_End, payrolldate, payrollpaytype, 202 AS Headersort, 'SSS Pro' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment



	--'append philhealth
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(contributionphilhealthee AS DECIMAL(10,2)) as contributionphilhealthee , Date_Start, Date_End, payrolldate, payrollpaytype, 203 AS Headersort, 'PHILHEALTH' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append pagibig
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,contributionpagibigee, Date_Start, Date_End, payrolldate, payrollpaytype, 204 AS Headersort, 'PagIbig' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append wtax
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,wtax, Date_Start, Date_End, payrolldate, payrollpaytype, 205 AS Headersort, 'Withholding Tax' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	
	--'append total deduction
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(totaldeduction AS DECIMAL(10,2)) as totaldeduction, Date_Start, Date_End, payrolldate, payrollpaytype, 9999 AS Headersort, 'Total Deduction' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Netamount

	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(netamount AS DECIMAL(10,2)) as netamount, Date_Start, Date_End, payrolldate, payrollpaytype, 10000 AS Headersort, 'Net Amount' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Netamount2 for payslip
	--INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    --SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(netamount2 AS DECIMAL(10,2)) as netamount2, Date_Start, Date_End, payrolldate, payrollpaytype, 10000.1 AS Headersort, 'Net Amount2' AS Headername,@uname AS uname
    --FROM payroll_summary
    --WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment



	--'append thirteenmonth
	INSERT INTO payroll_summary2
	(IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, Amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
	SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(thirteenmonth AS DECIMAL(10, 2)) AS thirteenmonth, Date_Start, Date_End, payrolldate, payrollpaytype, 
    11000 AS Headersort, '13th Month Cuttoff' AS Headername, @uname AS uname,@guid
	FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment

	--'append thirteenmonth YTD
	INSERT INTO payroll_summary2
	(IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, Amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
	SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(ytdthirteenmonth AS DECIMAL(10, 2)) AS thirteenmonth, Date_Start, Date_End, payrolldate, payrollpaytype, 
    11100 AS Headersort, '13th Month YTD' AS Headername, @uname AS uname,@guid
	FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment

	--SILP per cuttoff
	INSERT INTO payroll_summary2
	(IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, Amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
	SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(silp AS DECIMAL(10, 2)) AS thirteenmonth, Date_Start, Date_End, payrolldate, payrollpaytype, 
    11001 AS Headersort, 'SIL Cuttoff' AS Headername, @uname AS uname,@guid
	FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment



             

-------------------------Payroll report  other dededuction Process -----------------------------------



--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17
DECLARE @idpayrollsum  int
DECLARE @employeeid  int
DECLARE @fname2 varchar(30)
DECLARE @lname2 varchar(30)
DECLARE @mname2 varchar(30)

DECLARE @idclientp2 int
DECLARE @departmentdesc2 varchar(30)
DECLARE @department_codep int
DECLARE @payrollpaytype varchar(15)
DECLARE @payrolldate varchar(20)
DECLARE @Date_Start varchar(20)
DECLARE @Date_end varchar(20)
DECLARE @codeotherdeduction float
DECLARE @particular varchar(30)
DECLARE @amount float
DECLARE @newparticular varchar(50)
DECLARE @newcodeotherdeduction float 
 
     
DECLARE myCursor3 CURSOR FOR
-- open payroll summary      

--List to be process
SELECT otherdeduction.idpayrollsum, 
                      otherdeduction.employee_id, 
                      payroll_summary.fname2,
                      payroll_summary.lname2,
                      payroll_summary.mname2, 
                      payroll_summary.idclientp, 
                      payroll_summary.departmentdesc2, 
                      payroll_summary.department_codep,
                      payroll_summary.payrollpaytype, 
                      payroll_summary.payrolldate, 
                      otherdeduction.Date_Start, 
                      otherdeduction.Date_end, 
                      otherdeduction.codeotherdeduction, 
                      otherdeduction.particular,
                      otherdeduction.amount 
                      FROM otherdeduction INNER JOIN payroll_summary ON otherdeduction.idpayrollsum = payroll_summary.idpayrollsum 
					  WHERE payroll_summary.idclientp = @idclient AND payroll_summary.date_start = @datestart and payroll_summary.department_codep= @iddepartment

	OPEN myCursor3
   
   FETCH NEXT FROM myCursor3 INTO @idpayrollsum,@employeeid,@fname2,@lname2,@mname2,@idclientp2, @departmentdesc2,@department_codep,@payrollpaytype,@payrolldate,@Date_Start,@Date_end,@codeotherdeduction,@particular,@amount
	WHILE @@FETCH_STATUS = 0
	
	BEGIN					
	  		--update payroll_summary set contributionphilhealthEE = @phiee,contributionphilhealthER=@phier where idpayrollsum=@pidpayrollsum2
			
			SET @newparticular =
			 CASE  
				--WHEN @particular = 'SSS Loan' OR @particular = 'Pag-Ibig Loan' or @particular ='SSS Loan Calamity'  or @particular = 'Pag-Ibig Loan Calamiy' THEN
				WHEN @particular Like '%Loan%'  THEN
				
				@particular 
			 ELSE 
				'Other Deduction'
			 END;
				
			SET @newcodeotherdeduction = 
			CASE  
			WHEN @particular Like '%Loan%'  THEN
				@codeotherdeduction 
			 ELSE 
				252
			 END;



			INSERT INTO payroll_summary2(
			idpayrollsum
			,employee_id
			,fname
			,lname,mname
			,idclientp
			,departmentdesc2
			,department_codep
			,amount
			,date_start
			,date_end
			,payrolldate
			,payrollpaytype
			,uname
			,headersort
			,headername
			,guid) 
			Values
           (@idpayrollsum
			,@employeeid
			,@fname2
			,@lname2
			,@mname2
			,@idclientp2
			,@departmentdesc2
			,@department_codep
			,@amount
			,@date_start
			,@date_end
			,@payrolldate
			,@payrollpaytype
			,@uname
			,@newcodeotherdeduction
			,@newparticular
			,@guid)				   

						
	FETCH NEXT FROM myCursor3 INTO  @idpayrollsum,@employeeid,@fname2,@lname2,@mname2,@idclientp2, @departmentdesc2,@department_codep,@payrollpaytype,@payrolldate,@Date_Start,@Date_end,@codeotherdeduction,@particular,@amount
	END
	CLOSE myCursor3
	DEALLOCATE myCursor3

	   	  -------------------- End Other Deduction Process-----------------------------------------






		  ----------------------------------------Ajustment Processs--------------------------------------


--DECLARE @idclient int =17
--DECLARE @datestart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17
--Declare @uname varchar(10)='pat'


DECLARE @Aidpayrollsum  int
DECLARE @Aemployeeid  int
DECLARE @Afname2 varchar(30)
DECLARE @Alname2 varchar(30)
DECLARE @Amname2 varchar(30)

DECLARE @Aidclientp2 int
DECLARE @Adepartmentdesc2 varchar(30)
DECLARE @Adepartment_codep int
DECLARE @Apayrollpaytype varchar(15)
DECLARE @Apayrolldate varchar(20)
DECLARE @ADate_Start varchar(20)
DECLARE @ADate_end varchar(20)
DECLARE @Acodeadjustment float
DECLARE @Aparticular varchar(30)
DECLARE @Aamount float
 
     
DECLARE myCursor4 CURSOR FOR
-- open payroll summary      

--List to be process
SELECT adjustment.idpayrollsum, 
                      adjustment.employee_id, 
                      payroll_summary.fname2,
                      payroll_summary.lname2,
                      payroll_summary.mname2, 
                      payroll_summary.idclientp, 
                      payroll_summary.departmentdesc2, 
                      payroll_summary.department_codep,
                      payroll_summary.payrollpaytype, 
                      payroll_summary.payrolldate, 
                      adjustment.Date_Start, 
                      adjustment.Date_end, 
                      adjustment.codeadjustment, 
                      adjustment.particular,
                      adjustment.amount 
                      FROM adjustment INNER JOIN payroll_summary ON adjustment.idpayrollsum = payroll_summary.idpayrollsum 
					  WHERE payroll_summary.idclientp = @idclient AND payroll_summary.date_start = @datestart

	OPEN myCursor4
   
   FETCH NEXT FROM myCursor4 INTO @Aidpayrollsum,@Aemployeeid,@Afname2,@Alname2,@Amname2,@Aidclientp2, @Adepartmentdesc2,@Adepartment_codep,@Apayrollpaytype,@Apayrolldate,@ADate_Start,@ADate_end,@Acodeadjustment,@Aparticular,@Aamount
	WHILE @@FETCH_STATUS = 0
	
	BEGIN					
	  		--update payroll_summary set contributionphilhealthEE = @phiee,contributionphilhealthER=@phier where idpayrollsum=@pidpayrollsum2

			INSERT INTO payroll_summary2(
			idpayrollsum
			,employee_id
			,fname
			,lname,mname
			,idclientp
			,departmentdesc2
			,department_codep
			,amount
			,date_start
			,date_end
			,payrolldate
			,payrollpaytype
			,uname
			,headersort
			,headername
			,guid) 
			Values
           (@Aidpayrollsum
			,@Aemployeeid
			,@Afname2
			,@Alname2
			,@Amname2
			,@Aidclientp2
			,@Adepartmentdesc2
			,@Adepartment_codep
			,@Aamount
			,@Adate_start
			,@Adate_end
			,@Apayrolldate
			,@Apayrollpaytype
			,@uname
			,@Acodeadjustment
			,@Aparticular
			,@guid)				   

						
	FETCH NEXT FROM myCursor4 INTO  @Aidpayrollsum,@Aemployeeid,@Afname2,@Alname2,@Amname2,@Aidclientp2, @Adepartmentdesc2,@Adepartment_codep,@Apayrollpaytype,@Apayrolldate,@ADate_Start,@ADate_end,@Acodeadjustment,@Aparticular,@Aamount
	END
	CLOSE myCursor4
	DEALLOCATE myCursor4
	   	 

		  -----------------------------------End Adjustment Process --------------------------------------------
		  		   		   		  			 	 	   

--DECLARE @updateadjustment  NVARCHAR(MAX)
---   SET @updateadjustment =	N'UPDATE adjustment
--	SET codeadjustment = IncomeClass.codeadjustment
--	FROM adjustment INNER JOIN IncomeClass ON adjustment.particular = IncomeClass.Income_desc
--	WHERE adjustment.idclientincome = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND adjustment.date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
--EXEC (@updateadjustment)

	--Adjustment
	--DECLARE @adjustment  NVARCHAR(MAX)	
	--SET @adjustment= N'INSERT INTO payroll_summary2(IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, payrollpaytype, payrolldate, date_start, date_end, Headername, Headersort, Amount)
	--				SELECT adjustment.idpayrollsum, adjustment.employee_id, payroll_summary.fname2, payroll_summary.lname2, payroll_summary.mname2, payroll_summary.idclientp, payroll_summary.departmentdesc2, payroll_summary.department_codep, payroll_summary.payrollpaytype, payroll_summary.payrolldate, adjustment.Date_Start, adjustment.Date_End, adjustment.particular, adjustment.codeadjustment, adjustment.amount
	--				FROM adjustment INNER JOIN payroll_summary ON adjustment.idpayrollsum = payroll_summary.idpayrollsum
	--				WHERE payroll_summary.idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND payroll_summary.date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	--EXEC (@adjustment)

--DECLARE @updateotherdeduction  NVARCHAR(MAX)
--    SET @updateotherdeduction =	N'UPDATE otherdeduction
--	SET codeotherdeduction = otherdeductionclass.codeotherdeduction
--	FROM otherdeduction INNER JOIN otherdeductionclass ON otherdeduction.particular = otherdeductionclass.otherdeduction_desc
--	WHERE otherdeduction.idclientdeduction = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND otherdeduction.date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
--EXEC (@updateotherdeduction)



	-- Clean it up:	
	--DELETE FROM payroll_summary2 
	--WHERE
	--idClientp = @idclient 
	--AND Guid = @guid
	--AND date_start = @Date_Start
		
END 

