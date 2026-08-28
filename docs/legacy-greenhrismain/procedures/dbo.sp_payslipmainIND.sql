
-- =============================================
-- Author:      Pats Relos
-- Create date: 03-29-2026 @ 04:03 PM
-- Description: Payslip Main Details
-- =============================================
create PROCEDURE [dbo].[sp_payslipmainIND]
  --  @keytext VARCHAR(50)

    	@idemployee int,
		@idpayrollsum int


AS
BEGIN
    SET NOCOUNT ON;	  
SET NOCOUNT ON;

SELECT
    p.idpayrollsum,

    e.lname,
    e.fname,
    e.mname,

    p.jobposition2,
	client.companyname,
   

    p.Date_Start        AS datestart,
    p.Date_End          AS dateend,

    p.contributionSSSEE     AS sss,
    p.contributionSSSEEpro  AS ssspro,
    p.contributionphilhealthEE AS philhealth,
    p.contributionPagibigEE AS pagibig,

    p.Wtax,
    p.Other_Deduction   AS otherdeduction,
    p.Adjustment,
    p.Tardiness,

    p.grossalary,
    p.Totaldeduction,
    p.Totalsalary,
    p.netamount



FROM Employee AS e
INNER JOIN payroll_summary AS p
    ON e.Employee_id = p.Employee_id
INNER JOIN client
    ON p.idclientp = client.idclient

	WHERE p.idpayrollsum = @idpayrollsum	






			
END
