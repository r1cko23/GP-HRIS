-- =============================================
-- Author:		<Pat Relos>
-- Create date: <6-21-2024>
-- Description:	<Processing of Loan to Payroll>
-- =============================================
CREATE PROCEDURE [dbo].[SPbankreportall]	
-- Add the parameters for the stored procedure here
		
	@idclient int,
	@iddepartment int,
	@datestart date,
	@dateend date,
	@payout date,
	@paytype nvarchar(15),
	@payrollstatus nvarchar(10),
	@companyname nvarchar(150),
	@department nvarchar(100)


	   
AS


BEGIN

	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	

SELECT        payroll_summary.Employee_id
					,payroll_summary.Date_Start
					, payroll_summary.Date_End
					, payroll_summary.payrolldate
					, Employee.lname, Employee.fname
					, Employee.mname, Employee.date_birth
					, Employee.datehired 
                    , payroll_summary.netamount
					, payroll_summary.payrollpaytype
					,payroll_summary.payrollstatus
					, payroll_summary.payrollatmno
					,payroll_summary.empchequeno
					,payroll_summary.empmoneyxferno
					,payroll_summary.gcashp
					,payroll_summary.dailyrate_payroll
					,payroll_summary.noofhourswork
FROM            Employee INNER JOIN
                         payroll_summary ON Employee.Employee_id = payroll_summary.Employee_id

						

		WHERE (payroll_summary.idclientp = CASE WHEN @idclient = '' THEN idclientp ELSE @idclient END) 
		AND (payroll_summary.department_codep= CASE WHEN @iddepartment ='' then department_codep ELSE  @iddepartment END)
		AND (payroll_summary.Date_Start = CASE WHEN @datestart ='' then Date_Start ELSE  CONVERT(DATETIME, @datestart, 102)END)
		AND (payroll_summary.Date_End = CASE WHEN @dateend ='' then Date_End ELSE  CONVERT(DATETIME, @dateend, 102)END)

		AND (payroll_summary.payrolldate = CASE WHEN @payout ='' then payrolldate ELSE  CONVERT(DATETIME, @payout, 102)END)
		AND (payroll_summary.payrollpaytype = CASE WHEN @paytype ='' then payrollpaytype ELSE @paytype END)
		AND (payroll_summary.payrollstatus = CASE WHEN @payrollstatus ='' then payrollstatus ELSE @payrollstatus END)
		 
			
		 
								 


						

END
